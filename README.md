# VoxAction

The action layer for a phone line. During a live call, three spoken verbs —
`SEND`, `BOOK`, `SHARE` — become one-tap actions, and the call ends with a
verifiable receipt of what was agreed.

Built during the Cooee hackathon window, 6-7 October 2026.
Track: Real-Time Communication.

## What works

_Updated as tickets land. Currently: T1, the skeleton._

- three event types cross one bus, and the whole call is replayable from it
- the transcript view and the action card render from that bus
- speech, extraction and dispatch are fakes behind real interfaces

## What is not built

Deliberately out of scope for this build: calls to real phone numbers outside
the team, accounts and logins, addresses and money amounts, languages other
than English, mobile apps, deployment hardening.

Deferred by decision, and recorded in the design document: end-to-end
encryption, an SFU media server, voice activity detection, SQLite, and
SIP-over-WebSocket signalling.

## Setup

```bash
npm install
npm run dev        # the page
npm test           # the suite
npm run build      # typecheck and production build
```

If `npm install` reports only a handful of packages and `vitest` is then
missing, your environment has `NODE_ENV=production`, which makes npm omit every
devDependency. Install with `npm install --include=dev`.

## Dependencies

Runtime: `react`, `react-dom`, `zod`.
Development: `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`.

Planned, not yet installed: a local `faster-whisper` service for speech to text
(T3), and `matrix-js-sdk` for the signed log (T9).

## The design

`docs/DESIGN.html` holds the full design: the scope boundary, the free stack
with measured numbers, the latency budget, the phases, and the rejected
alternatives.

The design and the decisions were prepared before the window opened.
Every line of code was written inside the window.

## The one seam

Three event types cross one bus. Every phase adds a publisher or a subscriber.
No phase edits the contract.

```
audio  ─┐
stt    ─┼─→ EventBus ─┬─→ transcript view
llm    ─┤            ├─→ action card
dispatch┘            └─→ store (array → matrix → sqlite)
```

Each capability sits behind an interface, so a later phase swaps an
implementation rather than editing the pipeline:

| Interface | Fake now | Real later |
|---|---|---|
| `PeerManager` | `FakePeerManager` | WebRTC, holds a list for conference |
| `Transcriber` | `FakeTranscriber` | local faster-whisper, or Groq |
| `Extractor` | `FakeExtractor` | model call plus five gates |
| `Dispatcher` | empty registry | one handler per verb |
| `EventStore` | `InMemoryStore` | Matrix room, then SQLite |

## Running a call

Headphones are required on both participants. Without acoustic isolation each
microphone hears the other speaker, so the same sentence is transcribed twice
under two identities.

## Tickets

`.scratch/voxaction/issues/` holds one file per ticket, numbered in dependency
order, each declaring what blocks it.
