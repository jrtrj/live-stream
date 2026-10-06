# VoxAction

**The action layer for a phone line.** During a live call, three spoken verbs — `SEND`, `BOOK`,
`SHARE` — become real actions, and every action shows the sentence that caused it.

Built during the Cooee hackathon window, 6–7 October 2026. Track: Real-Time Communication.
Team: Sigzero.

## The idea

People say the same three things on every business call: *send me that*, *let's talk Tuesday*,
*here's my code*. Today somebody has to write those down, and things get missed.

VoxAction listens to the call, catches those three, and acts. Two rules hold it together:

1. **The model copies, the code decides.** The language model never produces a date, a phone number
   or an amount. It quotes the words, and deterministic code turns them into something real. A date
   invented by a model that fails silently is worse than no date at all.
2. **Every action quotes its evidence.** An action that cannot point at the exact words it came from
   is refused. You get a visible failure, never a confident wrong answer.

## What works today

| Capability | State | Notes |
|---|---|---|
| Two browsers on a real call | **real** | WebRTC, audio both ways. The peer identity is supplied, not inferred |
| The event bus and its store | **real** | The whole call is replayable from one log |
| Extraction: filter, model client, five gates | **real** | A fabricating model is caught and refused |
| `BOOK` → a real calendar invite | **real** | Verified in the browser, and the endpoint accepts it |
| `SHARE` → a real clipboard copy | **real** | Verified by reading the clipboard back |
| Local speech-to-text service | **real** | Transcribes real speech. Verified end to end |
| `SEND` → a real SMS | **not built** | Needs a Twilio account |
| The page's transcript | **scripted** | See the note below |
| The call receipt | **not built** | |

**Be precise about the transcript.** The call audio is real, and the speech service in `services/stt`
genuinely transcribes real speech — but the page currently replays a script, because the two are not
wired together yet. The `Transcriber` interface is where they will meet. Do not claim otherwise.

## Quick start

```bash
npm install --include=dev
npm run dev
```

`npm install` on its own may install almost nothing: if `NODE_ENV=production` is set in your shell,
npm omits every devDependency and the test suite disappears. Always use `--include=dev`.

Then open the printed URL, press **Start call**, and watch the action cards appear.

**Use headphones if two participants share a machine.** Each microphone must hear only its own
speaker. On open speakers the other voice bleeds in, and the same sentence is transcribed twice
under two identities.

### The three modes

```bash
# 1. Scripted. No model, no key, no network. This always works.
VITE_EXTRACTOR=scripted npm run dev

# 2. Real model, through the local proxy. This is the default.
npm run model          # http://127.0.0.1:8788, holds the key
npm run dev

# 3. Two browsers, one call. Start signalling, then open two tabs.
npm run signal         # ws://127.0.0.1:8787
npm run dev
```

The browser never holds a model API key. The proxy does, and the page talks to the proxy. An empty
key simply means no extractor is configured, and the page still runs.

### The local speech service

Optional, and separate from the Node project. It needs [uv](https://docs.astral.sh/uv/).

```bash
cd services/stt
uv sync                # once, from pyproject.toml
uv run python server.py
```

It listens on `http://127.0.0.1:8756`, loads and warms the model once at startup so no request pays
the load cost, and exposes `POST /transcribe?speaker=<id>&t_ms=<ms>` taking raw float32 PCM
(16 kHz, mono).

The speaker arrives as a parameter, because each participant's own machine knows who is speaking.
That is the whole reason this build needs no speaker diarisation.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | The page |
| `npm test` | The suite: 92 tests across 11 files |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Typecheck, then a production build |
| `npm run verify` | Typecheck, tests, and the gate checks |
| `npm run signal` | Signalling server on `:8787` |
| `npm run model` | Model proxy on `:8788` |
| `npm run timeline` | Regenerate `docs/TIMELINE.md` from git |

Three checks need a live process and so run outside the suite:
`node server/verify-signal.mjs`, `node server/verify-gates.mjs`, and `services/stt/selftest.py`.

## Dependencies

**Runtime**

| Package | Why |
|---|---|
| `react`, `react-dom` ^19 | The page |
| `zod` ^3.23 | Validates every model reply before anything acts on it |
| `ws` ^8.22 | The signalling and model servers |
| `chrono-node` ^2.10 | Turns *"Tuesday at 4"* into a real instant, anchored to the call |

**Development**

`vite` ^6, `@vitejs/plugin-react`, `typescript` ^5.7, `vitest` ^3, `@types/react`,
`@types/react-dom`, `@types/ws`.

Five runtime dependencies is a deliberate ceiling. `chrono-node` is the only one that could be
argued about, and hand-rolling natural-language date parsing is not worth it.

**Python**, in `services/stt` only: `faster-whisper` with `huggingface_hub<1`, pinned in
`pyproject.toml` with a committed lock. The pins matter — the library breaks against the current hub
release, and calls a media function that does not exist in the version that resolves.

## The one seam

Three event types cross exactly one bus, and nothing edits that contract afterwards.

```
audio  ─┐
stt    ─┼─→ EventBus ─┬─→ transcript view
llm    ─┤            ├─→ action card
dispatch┘            └─→ store (array → matrix → sqlite)
```

Each capability sits behind an interface, so a later phase swaps an implementation rather than
editing the pipeline. `src/app.ts` is the only file that names an implementation.

| Interface | Fake | Real |
|---|---|---|
| `PeerManager` | `FakePeerManager` | `WebRtcPeerManager`, holds a list for conference |
| `Transcriber` | `FakeTranscriber` | the local service, or a cloud model |
| `Extractor` | `FakeExtractor` | `LlmExtractor` plus five gates |
| `Dispatcher` | an empty registry | one handler per verb |
| `EventStore` | `InMemoryStore` | Matrix room, then SQLite |

The verb list is closed at three on purpose. A fourth verb is a scope change, not a feature: each
verb is a *class* of side effect, and the payload inside it is open.

## Where things live

```
src/contract/     the frozen event contract
src/core/         the bus, the store, one file per interface, the gates, the handlers
src/ui/           the page
server/           signalling, the model proxy, and the verification scripts
services/stt/     the Python speech service
tests/            92 tests across 11 files
docs/             DESIGN.html, TIMELINE.md, REVIEWING.md, tickets/
.scratch/         one file per ticket, in dependency order
```

## Documentation

- **`docs/DESIGN.html`** — the full design: the scope boundary, the free stack with measured numbers,
  the latency budget, the rejected alternatives, and a record of what was actually built.
- **`docs/TIMELINE.md`** — generated from git, so it cannot drift from what happened.
- **`docs/REVIEWING.md`** — read this before running anything.
- **`docs/tickets/`** — one record per ticket, with its evidence and any deviation.

The design and the decisions were prepared before the window opened. Every line of code was written
inside the window.

## Out of scope

Calls to real phone numbers outside the team, accounts and logins, multiple languages, mobile apps,
and deployment hardening.

Deferred by decision, and recorded in the design: end-to-end encryption, an SFU media server, voice
activity detection, SQLite, and SIP-over-WebSocket signalling.
