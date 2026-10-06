# T4 — Extract intents, five gates, fixtures

**Status:** complete
**Started:** 2026-10-06 19:59 IST
**Completed:** 2026-10-06 19:47 IST
**Ticket:** `.scratch/voxaction/issues/04-extract-intents-gates.md` · GitHub #4

## What was built

Spoken requests become action cards. A language model classifies and copies; ordinary code decides
whether to believe it.

- **The cheap filter.** A regular expression set in front of the model. No trigger means the model
  is never called and the quota is never spent.
- **The five gates**, as pure functions: schema, evidence, verbatim, required, catalogue.
- **`LlmExtractor`**, the real implementation behind the existing `Extractor` interface.
- **`HttpModelClient`**, an OpenAI-compatible client whose key is optional.
- **A model proxy**, so the browser never holds a key.
- **The extractor mode is explicit**: `model` by default, `scripted` for the offline demonstration.

## Timeline

| Time | Event |
|---|---|
| 19:59 | Read the subagent artifacts: the prompt and nineteen fixtures. |
| 20:02 | Wrote the failing tests: 23 for the gates, 6 for the extractor. |
| 20:05 | Confirmed RED for the right reason, with 20 existing tests still green. |
| 20:08 | Implemented the gates and the extractor. |
| 20:09 | GREEN: 49 of 49. |
| 20:14 | Added the proxy after spotting that a browser-side key is public. |
| 20:20 | Moved the fixture checks into the suite: node cannot resolve the extensionless imports in `src/`. |
| 20:24 | Proxy chain verified, 4 of 4. |
| 20:28 | Fixed the regression the rewiring introduced, then re-verified in the browser. |
| 20:31 | All gates green. Committed. |

## Decisions

- **The gates are pure functions.** They take the raw reply and the transcript and return accepted
  intents. That is why 23 tests cover them without a model, a key or a network.
- **The model sits behind `ModelClient`.** The extractor is tested with a stub that counts its calls,
  which proves the filter actually prevents the call rather than merely being written.
- **A failure is a rejection, never a guess.** Every gate returns nothing rather than repairing.
- **The catalogue is the boundary of SEND.** A caller can ask for anything; the application can only
  send what it owns, so an item outside the table is rejected. `send money to account 998877` cannot
  become an action even if the model reports it.
- **The model proxy exists because a key in the client bundle is public.** The browser posts the
  prompt to a local proxy, which adds the key. With no key the proxy refuses with 503 rather than
  calling upstream bare.
- **An unreachable model produces no intents and reports why.** It does not throw into the bus, and
  it is not silent.
- **The extractor mode is explicit, never a silent fallback.** Wiring only the real extractor
  removed the action card from the offline demonstration, so the mode is a named choice.

## Deviations from the design document

The design lists gate 4 as *resolvable*: a date library parses `when_text` into a real future date.
**T4 implements it as *required* instead** — the payload must be complete for its verb — and leaves
resolution to the calendar ticket, because this ticket's own acceptance criterion is that BOOK
yields `when_text` and never a resolved date. Section 04 of the design therefore describes the state
after the calendar ticket, not after this one. Recorded rather than quietly reinterpreted.

## Evidence

```
npm test                        7 files, 57 tests passed
npx tsc --noEmit                clean
npm run build                   built
node server/verify-gates.mjs    4 of 4 checks passed
node server/verify-signal.mjs   10 of 10 checks passed
```

The suite now covers the filter, all five gates, the failure path, and every fixture:

- every intent an accurate model would produce is accepted, across all nineteen fixtures
- a model that fires a plausible SEND on every empty case is caught on all eight
- an invented code is rejected; a resolved date is rejected; an unowned item is rejected
- the model is not called at all when the filter finds no trigger
- an unreachable model returns nothing and reports the reason

In the browser, scripted mode still renders four attributed captions and one action card carrying
its evidence quote.

## Deferred

- **Date resolution for BOOK.** The calendar ticket owns it.
- **The prompt has still never been sent to a real language model.** Every check so far uses a stub,
  a fixture, or the mock scorer. The first real call is unverified.
- The `base.en` accuracy problem from T3 is unaffected by this ticket.

## Problems and corrections

- **A false success claim.** A script reported `wrote server/model.ts` while the file was never
  written: the content was defined in a dictionary and no write loop ran. The missing file was
  caught by the verification step, not by the report. The lesson is that a printed claim is not
  evidence.
- **Node cannot resolve the extensionless imports in `src/`.** The planned standalone gate
  verification was moved into the vitest suite, where the resolver handles them, and the standalone
  script was reduced to the proxy chain, which imports nothing from `src/`.
- **A regression introduced by this ticket.** Replacing the fake extractor with the real one removed
  the action card from the offline demonstration. Fixed by making the mode explicit.
- **The first proxy check was flaky** because it waited a fixed 700 ms; it now polls for readiness
  and reports a child's output if it dies.
