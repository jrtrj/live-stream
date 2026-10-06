import { useEffect, useMemo, useState } from 'react'
import { createApp } from '../app'
import { isAction, isIntent, isTranscript, type CallEvent } from '../contract/events'

export function App() {
  const app = useMemo(() => createApp(), [])
  const [events, setEvents] = useState<CallEvent[]>([])
  const [live, setLive] = useState(false)

  useEffect(() => {
    setEvents([...app.bus.all()])
    return app.bus.subscribe(() => setEvents([...app.bus.all()]))
  }, [app])

  const transcripts = events.filter(isTranscript)
  const intents = events.filter(isIntent)
  const actions = events.filter(isAction)

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
          Spoken words become actions. T1 skeleton: the seam is live, every capability is fake.
        </p>
        <div className="row">
          <button onClick={onStart} disabled={live}>
            Start call
          </button>
          <button onClick={onHangUp} disabled={!live} className="ghost">
            Hang up
          </button>
          <span className={live ? 'dot on' : 'dot'} />
          <span className="mono">{live ? 'live' : 'idle'}</span>
        </div>
      </header>

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
