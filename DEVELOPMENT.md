# DEVELOPMENT.md — VoxAction

How the project is built, tested, and run.
Last updated: 2026-10-06 19:17 IST.

## What this is

A browser application. Two or more participants join a call, their speech is
transcribed on their own machines, three spoken verbs become one-tap actions,
and the call ends with a receipt.

## Project structure

```
src/
  contract/     the frozen types and the payload schemas
  core/         one interface per capability, each with a fake behind it
  ui/           the interface
  app.ts        the composition root — the only file that names an implementation
server/         the signalling server
services/stt/   the local speech-to-text service (T3)
prompts/        the extraction prompt (T4)
scripts/        offline tools, including the fixture scorer (T4)
tests/          the suite
docs/           the design and the per-ticket implementation records
skills/         project skills for agents
.scratch/       the tickets
```

## Setup

```bash
npm install --include=dev
npm run dev        # the page
npm test           # the suite
npm run build      # typecheck and production build
npm run typecheck  # typecheck alone
```

`NODE_ENV=production` is set in this environment. It makes npm omit every
devDependency, so `vitest` will be missing after a plain `npm install`. Always
pass `--include=dev`.

## The one seam

Three event types cross one bus. Tests drive the bus; implementations attach to
it. The ideal number of seams is one, and this is it.

```
audio  ─┐
stt    ─┼─→ EventBus ─┬─→ transcript view
llm    ─┤            ├─→ action card
dispatch┘            └─→ store (array, then matrix, then sqlite)
```

## The interfaces

| Interface | Fake now | Real later |
|---|---|---|
| `PeerManager` | `FakePeerManager` | WebRTC, holding a list of peers |
| `Transcriber` | `FakeTranscriber` | local `faster-whisper`, or Groq |
| `Extractor` | `FakeExtractor` | a model call plus five gates |
| `Dispatcher` | empty registry | one handler per verb |
| `EventStore` | `InMemoryStore` | a matrix room, then SQLite |

## Testing

Tests run with `vitest` in the node environment. They test external behaviour at
the highest available seam, and they do not test implementation details.

Current coverage: the event bus, the dispatcher registry, and the payload
schemas. The refusal cases matter as much as the acceptance cases — a fourth
verb is rejected, a reply without an evidence quote is rejected, and an
unregistered verb produces a failure rather than a silent no-op.

## Measured facts

Do not restate these from memory. Re-measure when it matters.

- Transcription, this machine, `base.en`, int8, four threads: a three-second
  chunk takes 1.30 s and a fifteen-second file takes 1.46 s.
- `small.en` takes 4.82 s for a three-second chunk and cannot caption live.
- Whisper pads every input to thirty seconds, so compute per call is nearly
  constant. Longer windows are cheaper per second of audio.

## Speech to text service

`services/stt/` runs `faster-whisper` `base.en` behind a small HTTP interface.
It accepts 16 kHz mono PCM and returns text. Two tooling traps apply, and both
are recorded in that service's README: `faster-whisper` is incompatible with
`huggingface_hub` version 1 and above, and it calls a PyAV function that does not
exist in the version that resolves here. The fix is to decode audio into a
float32 array and pass the array to the model.

## Signals and audio

Audio is browser to browser. No media server is used. Signalling is a small
WebSocket server in `server/`. Headphones are required on every participant, for
the reason recorded in `AGENTS.md`.

## References

- `docs/DESIGN.html` — the full design.
- `docs/tickets/` — one implementation record per ticket.
- `PROGRESS.md` — the dated history.
- `.scratch/voxaction/issues/` — the tickets.
