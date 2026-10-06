import { createEventBus, type EventBus } from './core/bus'
import { InMemoryStore } from './core/store'
import { WebRtcPeerManager } from './core/webrtc'
import type { PeerManager } from './core/peer'
import { FakeTranscriber, SCRIPTED_TURNS, turnsFor, type Transcriber } from './core/transcriber'
import { FakeExtractor, LlmExtractor, type Extractor } from './core/extractor'
import { HttpModelClient } from './core/modelClient'
import { createDispatcher, type Dispatcher } from './core/dispatcher'
import { bookHandler } from './core/calendar'
import { shareHandler } from './core/share'
import {
  isTranscript,
  type IntentEvent,
  type Speaker,
  type TranscriptEvent,
} from './contract/events'

const AGENT: Speaker = { id: 'agent', name: 'Agent' }
const CLIENT: Speaker = { id: 'client', name: 'Client' }

const SIGNAL_URL: string = import.meta.env?.VITE_SIGNAL_URL ?? 'ws://127.0.0.1:8787'
const ROOM: string = import.meta.env?.VITE_ROOM ?? 'voxaction-demo'

// The model is reached through the proxy, which holds the key. An empty value
// means no extractor is configured and the fake is used instead, so the page
// always works.
const MODEL_URL: string = import.meta.env?.VITE_MODEL_URL ?? 'http://127.0.0.1:8788/extract'

// Which extractor to use is an explicit choice, never a silent fallback. The
// scripted one needs no model, no proxy and no key, so the page always works.
const EXTRACTOR_MODE: string = import.meta.env?.VITE_EXTRACTOR ?? 'model'

export interface App {
  readonly bus: EventBus
  readonly peers: PeerManager
  readonly dispatcher: Dispatcher
  readonly speakers: { agent: Speaker; client: Speaker }
  startCall(): Promise<void>
  hangUp(): void
  startedAt(): number
  notice(): string
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
  const peers: PeerManager = new WebRtcPeerManager({ url: SIGNAL_URL, room: ROOM })
  const transcriber: Transcriber = new FakeTranscriber()
  let modelNotice = ''
  const extractor: Extractor =
    EXTRACTOR_MODE === 'scripted'
      ? new FakeExtractor()
      : new LlmExtractor(
          new HttpModelClient({
            url: MODEL_URL,
            // Empty by design. The key belongs to the proxy, never to the client.
            apiKey: '',
            model: 'proxy',
          }),
          { onError: (message) => { modelNotice = message } },
        )
  const dispatcher = createDispatcher()
  // T6. The dispatcher is a registry, so this is the whole integration.
  dispatcher.register('BOOK', bookHandler)
  dispatcher.register('SHARE', shareHandler)

  const emitted = new Set<string>()
  let live = false
  let began = 0
  let message = ''

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

  return {
    bus,
    peers,
    dispatcher,
    speakers: { agent: AGENT, client: CLIENT },
    startedAt: () => began,
    notice: () => message || modelNotice,

    async startCall(): Promise<void> {
      if (live) return
      live = true
      began = Date.now()

      // The call is real. If there is no microphone or no signalling server,
      // the failure is reported rather than hidden, and the transcript script
      // still runs so the rest of the path can be demonstrated.
      try {
        await peers.join(AGENT, () => {})
      } catch (error) {
        message = `no audio yet: ${(error as Error).message}`
      }

      await transcriber.warmup()
      // Derived from the script, so a new line is always spoken.
      const order = turnsFor(SCRIPTED_TURNS, CLIENT, AGENT)
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
