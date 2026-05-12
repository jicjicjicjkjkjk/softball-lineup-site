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
    'In Play': 'InPlay',
    Strikeout: 'K',
    Walk: 'BB',
    'Weak Hit': 'Weak',
    'Big Hit': 'Big',
    Inside: 'IN',
    Outside: 'OUT',
    Middle: 'MID',
    'High Inside': 'HI',
    'Low Inside': 'LI',
    'High Outside': 'HO',
    'Low Outside': 'LO',
  }

  return map[label] || label
}

export default function PitchCallingPage({ games = [], players = [], setAppError }) {
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
  const [thisAbEvents, setThisAbEvents] = useState([])
  const [showLineup, setShowLineup] = useState(false)

  const activePlayers = useMemo(
    () =>
      players
        .filter((p) => p.active !== false)
        .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [players]
  )

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

  const pitchTypes = options
    .filter((o) => o.category === 'pitch_type' && o.is_active !== false)
    .sort(byOrder)

  const locations = options
    .filter((o) => o.category === 'pitch_location' && o.is_active !== false)
    .sort(byOrder)

  const pitchResults = options
    .filter((o) => o.category === 'pitch_result' && o.is_active !== false)
    .sort(byOrder)

  const atBatResults = options
    .filter((o) => o.category === 'at_bat_result' && o.is_active !== false)
    .sort(byOrder)

  const currentBatter = batters.find(
    (b) => Number(b.batting_order) === Number(currentSpot)
  )

  const maxSpot = Math.max(
    1,
    ...batters.map((b) => Number(b.batting_order || 1))
  )

  const batterHistory = history.filter(
    (event) => String(event.batter_id) === String(currentBatter?.id)
  )

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
    const linkedGame = games.find(
      (g) => String(g.id) === String(selectedGameId)
    )

    const res = await supabase
      .from('pitch_call_games')
      .insert({
        game_id: selectedGameId || null,
        opponent_name:
          opponentName ||
          linkedGame?.opponent ||
          linkedGame?.opponent_name ||
          null,
        pitcher_id: pitcherId || null,
        current_batter_order: 1,
      })
      .select('*')
      .single()

    if (res.error) return setAppError(res.error.message)

    const batterRes = await supabase
      .from('pitch_call_batters')
      .insert(
        buildBlankBatters().map((b) => ({
          ...b,
          pitch_call_game_id: res.data.id,
        }))
      )
      .select('*')

    if (batterRes.error) return setAppError(batterRes.error.message)

    setPitchGame(res.data)
    setBatters(batterRes.data || [])
    setCurrentSpot(1)
  }

  async function updateBatter(id, field, value) {
    setBatters((current) =>
      current.map((b) =>
        b.id === id ? { ...b, [field]: value } : b
      )
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
  }

  async function saveEvent({
    skipped = false,
    skippedReason = '',
    resultOnly = false,
    quickFinalResultId = '',
  } = {}) {
    if (!pitchGame?.id || !currentBatter?.id) return

    const finalResult = quickFinalResultId || atBatResultId || null

    const payload = {
      pitch_call_game_id: pitchGame.id,
      batter_id: currentBatter.id,
      pitcher_id: pitcherId || null,
      pitch_option_id: resultOnly ? null : calledPitchId || null,
      intended_location_id: resultOnly
        ? null
        : intendedLocationId || null,
      actual_location_id: resultOnly
        ? null
        : actualLocationId || null,
      pitch_result_id: resultOnly
        ? null
        : pitchResultId || null,
      at_bat_result_id: finalResult,
      coach_note: coachNote || null,
      skipped,
      skipped_reason: skippedReason || null,
    }

    const res = await supabase
      .from('pitch_call_events')
      .insert(payload)

    if (res.error) return setAppError(res.error.message)

    const pitchLabel =
      pitchTypes.find(
        (p) => String(p.id) === String(calledPitchId)
      )?.label || ''

    const resultLabel =
      pitchResults.find(
        (p) => String(p.id) === String(pitchResultId)
      )?.label || ''

    const actualLabel =
      locations.find(
        (l) => String(l.id) === String(actualLocationId)
      )?.label || ''

    const summary = resultOnly
      ? shortLabel(
          atBatResults.find(
            (r) => String(r.id) === String(finalResult)
          )?.label || 'Other'
        )
      : [
          shortLabel(pitchLabel),
          actualLabel ? shortLabel(actualLabel) : '',
          shortLabel(resultLabel),
        ]
          .filter(Boolean)
          .join(' • ')

    setThisAbEvents((current) => [...current, summary])

    resetEntry()
    await loadHistory()

    if (finalResult || skipped || resultOnly) {
      setThisAbEvents([])
      goNext()
    }
  }

  function goNext() {
    setThisAbEvents([])
    setCurrentSpot((current) =>
      current >= maxSpot ? 1 : current + 1
    )
  }

  function goPrevious() {
    setThisAbEvents([])
    setCurrentSpot((current) =>
      current <= 1 ? maxSpot : current - 1
    )
  }

  if (!pitchGame) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1>Pitch Calling</h1>
            <p>Quick coach pitch-call tracker.</p>
          </div>
        </div>

        <div className="card">
          <h2>Start Pitch Tracking</h2>

          <div className="grid-3">
            <label>
              Existing Game
              <select
                value={selectedGameId}
                onChange={(e) =>
                  setSelectedGameId(e.target.value)
                }
              >
                <option value="">No linked game</option>

                {sortedGames.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.game_date || game.date} —{' '}
                    {game.opponent ||
                      game.opponent_name ||
                      'Opponent'}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Opponent Name
              <input
                value={opponentName}
                onChange={(e) =>
                  setOpponentName(e.target.value)
                }
                placeholder="Opponent"
              />
            </label>

            <label>
              Pitcher
              <select
                value={pitcherId}
                onChange={(e) =>
                  setPitcherId(e.target.value)
                }
              >
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
    <div style={{ paddingBottom: 110 }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: '#123847',
          color: 'white',
          borderRadius: 16,
          padding: 12,
          marginBottom: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontWeight: 800 }}>
            {opponentName || 'Opponent'}
          </div>

          <div style={{ fontSize: 12, opacity: 0.9 }}>
            Batter {currentSpot}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowLineup((v) => !v)}
        >
          Lineup
        </button>
      </div>

      {showLineup && (
        <div className="card">
          <div
            style={{
              display: 'grid',
              gap: 10,
            }}
          >
            {batters.map((batter) => {
              const miniHistory = history
                .filter(
                  (event) =>
                    String(event.batter_id) ===
                    String(batter.id)
                )
                .slice(0, 2)

              return (
                <div
                  key={batter.id}
                  style={{
                    border:
                      Number(batter.batting_order) ===
                      Number(currentSpot)
                        ? '2px solid #167c74'
                        : '1px solid #d1d5db',
                    borderRadius: 12,
                    padding: 10,
                    background:
                      Number(batter.batting_order) ===
                      Number(currentSpot)
                        ? '#eef6f5'
                        : 'white',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        '40px 70px 1fr',
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentSpot(
                          Number(batter.batting_order)
                        )
                      }
                    >
                      {batter.batting_order}
                    </button>

                    <input
                      placeholder="#"
                      value={batter.player_number || ''}
                      onChange={(e) =>
                        updateBatter(
                          batter.id,
                          'player_number',
                          e.target.value
                        )
                      }
                    />

                    <input
                      placeholder="Name"
                      value={batter.batter_name || ''}
                      onChange={(e) =>
                        updateBatter(
                          batter.id,
                          'batter_name',
                          e.target.value
                        )
                      }
                    />
                  </div>

                  <input
                    placeholder="Quick note"
                    value={batter.quick_note || ''}
                    onChange={(e) =>
                      updateBatter(
                        batter.id,
                        'quick_note',
                        e.target.value
                      )
                    }
                  />

                  {!!miniHistory.length && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        color: '#4b5563',
                      }}
                    >
                      {miniHistory.map((event) => (
                        <div key={event.id}>
                          {shortLabel(
                            atBatResults.find(
                              (r) =>
                                String(r.id) ===
                                String(
                                  event.at_bat_result_id
                                )
                            )?.label ||
                              pitchResults.find(
                                (r) =>
                                  String(r.id) ===
                                  String(
                                    event.pitch_result_id
                                  )
                              )?.label ||
                              'Tracked'
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

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
            <h2>
              Batter {currentSpot}
              {currentBatter?.player_number
                ? ` — #${currentBatter.player_number}`
                : ''}
            </h2>

            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 700 }}>
                {currentBatter?.quick_note ||
                  'No note yet.'}
              </div>

              {!!thisAbEvents.length && (
                <div
                  style={{
                    marginTop: 10,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                  }}
                >
                  {thisAbEvents.map((item, index) => (
                    <div
                      key={`${item}-${index}`}
                      style={{
                        background: '#eef6f5',
                        border: '1px solid #cfe5e1',
                        borderRadius: 999,
                        padding: '6px 10px',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {index + 1}. {item}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
            }}
          >
            <button type="button" onClick={goPrevious}>
              Prev
            </button>

            <button type="button" onClick={goNext}>
              Next
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Pitch Type</h3>

        <div className="button-grid">
          {pitchTypes.map((pitch) => (
            <button
              key={pitch.id}
              type="button"
              className={
                calledPitchId === pitch.id
                  ? 'primary'
                  : ''
              }
              onClick={() =>
                setCalledPitchId(pitch.id)
              }
            >
              {shortLabel(pitch.label)}
            </button>
          ))}
        </div>

        <h3>Called Location</h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            marginBottom: 16,
          }}
        >
          {locations.map((loc) => (
            <button
              key={loc.id}
              type="button"
              className={
                intendedLocationId === loc.id
                  ? 'primary'
                  : ''
              }
              onClick={() =>
                setIntendedLocationId(loc.id)
              }
            >
              {shortLabel(loc.label)}
            </button>
          ))}
        </div>

        <h3>Pitch Result</h3>

        <div className="button-grid">
          {pitchResults.map((result) => (
            <button
              key={result.id}
              type="button"
              className={
                pitchResultId === result.id
                  ? 'primary'
                  : ''
              }
              onClick={() =>
                setPitchResultId(result.id)
              }
            >
              {shortLabel(result.label)}
            </button>
          ))}
        </div>

        <details style={{ marginTop: 16 }}>
          <summary>Optional Actual Location + Notes</summary>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              marginTop: 12,
              marginBottom: 12,
            }}
          >
            {locations.map((loc) => (
              <button
                key={loc.id}
                type="button"
                className={
                  actualLocationId === loc.id
                    ? 'primary'
                    : ''
                }
                onClick={() =>
                  setActualLocationId(loc.id)
                }
              >
                {shortLabel(loc.label)}
              </button>
            ))}
          </div>

          <input
            value={coachNote}
            onChange={(e) =>
              setCoachNote(e.target.value)
            }
            placeholder="Coach note"
          />
        </details>

        <h3 style={{ marginTop: 18 }}>
          Final Result
        </h3>

        <div className="button-grid">
          {atBatResults.map((result) => (
            <button
              key={result.id}
              type="button"
              className={
                atBatResultId === result.id
                  ? 'primary'
                  : ''
              }
              onClick={() =>
                setAtBatResultId(result.id)
              }
            >
              {shortLabel(result.label)}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          background: 'white',
          borderTop: '1px solid #d1d5db',
          padding: 8,
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 8,
          zIndex: 50,
        }}
      >
        <button type="button" onClick={() => saveEvent()}>
          Save
        </button>

        <button
          type="button"
          onClick={() =>
            saveEvent({
              quickFinalResultId: atBatResultId,
            })
          }
        >
          End AB
        </button>

        <button
          type="button"
          onClick={() =>
            saveEvent({
              resultOnly: true,
              quickFinalResultId:
                atBatResults[0]?.id || '',
            })
          }
        >
          Result
        </button>

        <button
          type="button"
          onClick={() =>
            saveEvent({
              skipped: true,
              skippedReason: 'missed',
            })
          }
        >
          Missed
        </button>

        <button
          type="button"
          onClick={() => {
            resetEntry()
          }}
        >
          Clear
        </button>
      </div>
    </div>
  )
}
