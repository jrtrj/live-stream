import { useEffect, useMemo, useState } from 'react'
import { createApp } from '../app'
import { isAction, isIntent, isTranscript, type CallEvent } from '../contract/events'

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const minutes = String(Math.floor(total / 60)).padStart(2, '0')
  const seconds = String(total % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

export function App() {
  const app = useMemo(() => createApp(), [])
  const [events, setEvents] = useState<CallEvent[]>([])
  const [live, setLive] = useState(false)
  const [tick, setTick] = useState(Date.now())

  useEffect(() => {
    setEvents([...app.bus.all()])
    return app.bus.subscribe(() => setEvents([...app.bus.all()]))
  }, [app])

  // The call timer ticks while a call is running.
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => setTick(Date.now()), 250)
    return () => clearInterval(id)
  }, [live])

  const transcripts = events.filter(isTranscript)
  const intents = events.filter(isIntent)
  const actions = events.filter(isAction)
  const elapsed = live ? tick - app.startedAt() : 0

  async function onStart() {
    setLive(true)
    await app.startCall()
  }

  function onHangUp() {
    app.hangUp()
    setLive(false)
  }

  return (
    <main>
      <header>
        <h1>VoxAction</h1>
        <p className="sub">
          Spoken words become actions. The call is real audio; the transcript is still scripted
          until the speech service lands.
        </p>
        <div className="row">
          <button onClick={onStart} disabled={live}>
            Start call
          </button>
          <button onClick={onHangUp} disabled={!live} className="ghost">
            Hang up
          </button>
          <span className={live ? 'dot on' : 'dot'} />
          <span className="mono">{live ? clock(elapsed) : 'idle'}</span>
          <span className="mono">participants {app.peers.peers().length + (live ? 1 : 0)}</span>
          <span className="mono">link {app.peers.isConnected ? 'connected' : 'idle'}</span>
        </div>
        {app.notice() && <p className="notice">{app.notice()}</p>}
      </header>

      <p className="warn">
        Headphones are required on every participant. Each microphone must hear only its own
        speaker. On speakers, the other voice bleeds in and one sentence is transcribed twice.
      </p>

      <section>
        <h2>Transcript</h2>
        {transcripts.length === 0 && <p className="empty">No speech yet.</p>}
        {transcripts.map((e) => (
          <p className="line" key={`${e.t_ms}-${e.speaker.id}`}>
            <span className="who">{e.speaker.name}</span>
            <span>{e.text}</span>
          </p>
        ))}
      </section>

      <section>
        <h2>Actions</h2>
        {intents.length === 0 && <p className="empty">No action detected.</p>}
        {intents.map((i) => {
          const action = actions.find((a) => a.intent_id === i.id)
          return (
            <div className="card" key={i.id}>
              <span className="verb">{i.verb}</span>
              <span>{i.payload.verb === 'SEND' ? i.payload.item : i.payload.verb}</span>
              <span className="evidence">“{i.evidence}”</span>
              <span className="mono">
                {action ? action.status : 'awaiting handler'}
                {action?.error ? ` — ${action.error}` : ''}
              </span>
            </div>
          )
        })}
      </section>
    </main>
  )
}
