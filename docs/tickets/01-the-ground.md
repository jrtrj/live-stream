# T1 — The ground

**Status:** complete
**Started:** 2026-10-06 18:57 IST
**Completed:** 2026-10-06 19:07 IST
**Ticket:** `.scratch/voxaction/issues/01-the-ground.md`
**Commit:** `7d21100`

## What was built

The skeleton that every later ticket attaches to. Three event types cross one
event bus, and every capability exists as an interface with a fake behind it, so
a later phase swaps an implementation instead of editing the pipeline.

## Timeline

| Time | Event |
|---|---|
| 18:57 | The window was already open. Confirmed the clock: 1 hour 47 minutes in, with the first mentor check-in 60 minutes away. |
| 19:00 | Wrote the eleven tickets, the project configuration, and the page shell. |
| 19:03 | Wrote the contract, the bus, the five interfaces with fakes, the composition root, the interface, and three test files. |
| 19:05 | `npm install` installed 4 packages only. Diagnosed `NODE_ENV=production`. |
| 19:05 | Suite run: 11 of 11 pass. |
| 19:06 | Typecheck failed on the `vitest` 2 and `vite` 6 mismatch. Upgraded to `vitest` 3. |
| 19:06 | Suite and production build both green. |
| 19:08 | Browser run: four attributed captions, one action card, correct failure status. |
| 19:12 | Committed as `7d21100`. |

## Decisions

- **`Speaker` is an identity, not a role.** A two-value union would have to
  change for a conference, and the contract is frozen, so it is an object.
- **`PeerManager` holds a list from the first day.** The same reason.
- **`Transcriber.transcribe` takes the speaker as an argument.** Each
  participant's own machine knows who is speaking, which is why no diarisation
  is needed and why the identity is never guessed.
- **`Dispatcher` is a registry, not a switch.** `BOOK` and `SHARE` attach in
  their own tickets without editing this file or the pipeline that calls it.
- **The dispatcher reports an unregistered verb as a failure.** A silent no-op
  would hide a missing handler.
- **The composition root is the only file that names an implementation.**

## Evidence

```
npm test       3 files, 11 tests passed
npm run build  clean typecheck; vite built 37 modules
```

Browser run against the development server returned four caption lines with
correct participant attribution, one action card, and the status
`failed — no handler registered for SEND`.

## Deferred

- Deployment. It needs a hosting account.
- Real speech, real extraction, and real dispatch. T3 and T4 own those.

## Problems and corrections

- **`npm install` installed 4 packages.** `NODE_ENV=production` was set, so npm
  omitted every devDependency and `vitest` was absent. `--include=dev` fixed it.
  Recorded in `DEVELOPMENT.md` so the other two developers do not lose the time.
- **Typecheck failed.** `vitest` 2 depends on its own copy of `vite`, whose
  types conflict with `vite` 6. Upgraded to `vitest` 3.
- **Three subagents were dispatched and were interrupted within seconds,**
  producing no files. The speech service, the prompt with fixtures, and the
  WebRTC spike remain outstanding and are recorded as deferred.

## Corrections

An earlier revision of this record carried hand-written clock times that disagreed with the
git history, in one case placing completion before the start. The commit times are the
evidence; the step order is the narrative. `docs/TIMELINE.md` is generated from git and is
the authority for when.
