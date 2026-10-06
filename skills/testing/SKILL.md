---
name: voxaction-testing
description: Use when testing VoxAction — the seam, the commands, and what a good test looks like here.
---

# Testing VoxAction

## The seam

There is one seam: the event bus. Test at that seam and nowhere lower. A test
that reaches inside a module to check a private detail will break when the
implementation is swapped, which is exactly what the interfaces exist to avoid.

Drive the bus, then assert on what came out of it.

## Commands

```bash
npm test           # the whole suite
npm run typecheck  # types alone
npm run build      # typecheck plus production build
```

`NODE_ENV=production` is set in this environment. If `vitest` is missing,
`npm install` omitted the devDependencies. Install with `--include=dev`.

## What a good test looks like here

- It states behaviour, not implementation. `reports a failure when no handler is
  registered` is a good name. `calls handlers.get` is not.
- It covers the refusal case as carefully as the acceptance case. The closed verb
  list exists so that a fourth verb fails, and that failure needs a test.
- It uses real values from the domain: an evidence quote, a reference code, a
  spoken time phrase.

## The refusals that matter

These four are the contract, and each one already has a test:

1. A verb outside `SEND`, `BOOK`, `SHARE` is rejected.
2. A reply with no evidence quote is rejected.
3. A verb with no registered handler produces a failure, not a silent no-op.
4. An empty reply is accepted, because an empty reply is the correct answer when
   nothing was requested.

## Testing the language model without a model

Do not test the extractor by calling a provider. Replay fixtures instead:
`tests/fixtures/calls.jsonl` holds utterances with their expected intents, and
`scripts/score-extract.mjs` scores an extractor against them and prints per-verb
recall and precision plus the false-positive rate on the empty cases.

The empty cases matter most. A system that fires on everything looks impressive
for thirty seconds and then loses the room.

## Testing the speech model without a microphone

`faster-whisper` is a batch model and it pads every input to thirty seconds, so
compute per call is nearly constant. Measure with a generated clip rather than a
live microphone:

```bash
espeak-ng -v en-us -s 150 -w /tmp/clip.wav "send me the brochure"
```

A live microphone consumes the provider quota and cannot be replayed. A clip can.

## Verification rules

- Run the full suite once at the end, and state the count.
- A code read is not verification. Paste the command and its output.
- Cover one failure path as well as the happy path.
