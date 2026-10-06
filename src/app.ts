import { createEventBus, type EventBus } from './core/bus'
import { InMemoryStore } from './core/store'
import { FakePeerManager, type PeerManager } from './core/peer'
import { FakeTranscriber, type Transcriber } from './core/transcriber'
import { FakeExtractor, type Extractor } from './core/extractor'
import { createDispatcher, type Dispatcher } from './core/dispatcher'
import {
  isTranscript,
  type IntentEvent,
  type Speaker,
  type TranscriptEvent,
} from './contract/events'

const AGENT: Speaker = { id: 'agent', name: 'Agent' }
const CLIENT: Speaker = { id: 'client', name: 'Client' }

export interface App {
  readonly bus: EventBus
  readonly peers: PeerManager
  readonly dispatcher: Dispatcher
  readonly speakers: { agent: Speaker; client: Speaker }
  startCall(): Promise<void>
  hangUp(): void
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * The composition root. This is the only place that knows which implementation
 * sits behind each interface. Swapping fake for real, or cloud for local,
 * happens here and nowhere else.
 */
export function createApp(): App {
  const store = new InMemoryStore()
  const bus = createEventBus(store)
  const peers: PeerManager = new FakePeerManager(CLIENT)
  const transcriber: Transcriber = new FakeTranscriber()
  const extractor: Extractor = new FakeExtractor()
  const dispatcher = createDispatcher()

  const emitted = new Set<string>()

  // Speech to intent. The extractor reads the rolling window; each new intent
  // is published onto the same bus it arrived from.
  bus.subscribe((e) => {
    if (!isTranscript(e)) return
    const window = bus.all().filter(isTranscript) as TranscriptEvent[]
    void extractor.extract(window).then((results) => {
      for (const r of results) {
        const id = `${r.verb}:${r.evidence.slice(0, 24)}`
        if (emitted.has(id)) continue
        emitted.add(id)
        const intent: IntentEvent = { type: 'intent', id, t_ms: Date.now(), ...r }
        bus.publish(intent)
      }
    })
  })

  // Intent to action. With no handler registered the dispatcher reports a
  // failure rather than doing nothing quietly.
  bus.subscribe((e) => {
    if (e.type !== 'intent') return
    void dispatcher.dispatch(e).then((action) => bus.publish(action))
  })

  let live = false

  return {
    bus,
    peers,
    dispatcher,
    speakers: { agent: AGENT, client: CLIENT },
    async startCall(): Promise<void> {
      if (live) return
      live = true
      await peers.join(AGENT, () => {})
      await transcriber.warmup()
      const order: Speaker[] = [CLIENT, AGENT, CLIENT, AGENT]
      for (const who of order) {
        const event = await transcriber.transcribe(new Float32Array(0), who, Date.now())
        if (event) bus.publish(event)
        await sleep(1100)
      }
    },
    hangUp(): void {
      live = false
      peers.leave()
    },
  }
}
