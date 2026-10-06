# Reviewing VoxAction

For a teammate reviewing a branch, or joining the codebase cold.
Last updated: 2026-10-06 20:45 IST.

## Start here

1. `docs/TIMELINE.md` — what has landed, when, and in which commit. Generated, so it is current.
2. The ticket record for the work you are reviewing, under `docs/tickets/`. It carries the
   decisions, the commands that were run, and the output that proved it.
3. `docs/DESIGN.html` — the design, the scope boundary, and the rejected alternatives.

## What to run

```bash
npm install --include=dev     # NODE_ENV=production makes npm skip devDependencies
npm run typecheck
npm test                      # the suite
npm run build
npm run verify                # typecheck, tests, and the proxy checks
node server/verify-signal.mjs # signalling, needs the signalling server up
```

Two servers are needed for anything end to end:

```bash
npm run signal   # WebSocket signalling on 8787
npm run model    # the model proxy on 8788, needs MODEL_API_KEY
npm run dev      # the page
```

## What is real and what is not

Check this before believing anything on screen. It is the fastest way to avoid
reviewing a mock.

| Capability | State |
|---|---|
| Event contract, bus, store | **real** |
| Signalling room and server | **real** |
| Browser-to-browser audio | **real** |
| Dispatcher registry | **real**, but **no handlers are registered**, so every action reports a failure |
| Speech service (`services/stt/`) | **real**, verified end to end |
| `Transcriber` in the app | **fake** — scripted lines. The real service is not wired in. |
| `Extractor` | **real** — filter, model client, five gates. Configured by `VITE_EXTRACTOR`. |
| Actions: SMS, calendar, code | **not built** |
| Receipt and latency counter | **not built** |
| Matrix log | **not built** |

Set `VITE_EXTRACTOR=scripted` to run the page with no model, no proxy and no key.

## The one seam

Everything attaches to the event bus. If you are reviewing a change, ask which side of it the
change sits on: a publisher, a subscriber, or an implementation behind an interface. A change that
edits the contract or reaches across modules is a design change and needs saying out loud.

```
audio  ─┐
stt    ─┼─→ EventBus ─┬─→ transcript view
llm    ─┤            ├─→ action card
dispatch┘            └─→ store
```

## Known hazards

Read these before running anything. They have all cost time already.

1. **Never enable audio playback with two participants on one machine.** Two browser sessions
   sharing one output device re-capture each other and produce a feedback loop that echoes the
   user's own voice. Verify a second participant by connection state and received track. Headphones
   are mandatory for a real two-party test.
2. **`NODE_ENV=production` is set.** `npm install` silently omits every devDependency and `vitest`
   goes missing. Always pass `--include=dev`.
3. **Headless Chromium denies the microphone.** Grant it over CDP with `Browser.grantPermissions`,
   and never with playback attached.
4. **`base.en` mangles the payload this demo depends on.** It heard "Tuesday at four" as "to that
   for", twice, independently. See `docs/tickets/03-real-speech-per-speaker.md`.
5. **A peer joining an empty room can receive no offer** if the second peer arrives while the first
   reloads. A known, unfixed join-order race.
6. **The prompt has never been sent to a real language model.** Every check uses a stub, a fixture
   or the mock scorer.

## Undecided

- **Date resolution for BOOK.** `when_text` holds the speaker's own words and nothing resolves it
  yet. Measurements and the trap list are in the conversation that produced T4; the calendar ticket
  owns the fix.

## Branch and documentation conventions

The ticket records are one file per ticket, so parallel branches never conflict on them.

Two files are shared and append-only, and **will** conflict if two branches both edit them:

- `PROGRESS.md`
- `docs/TIMELINE.md` (regenerate it rather than merging it: `npm run timeline`)

Convention: a branch appends its entry at the **top** of `PROGRESS.md`. When merging, keep both
entries rather than choosing. Never reorder or reword somebody else's entry — the log is evidence.
