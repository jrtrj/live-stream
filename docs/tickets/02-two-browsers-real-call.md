# T2 — Two browsers on a real call

**Status:** complete
**Started:** 2026-10-06 19:18 IST
**Completed:** 2026-10-06 19:29 IST
**Ticket:** `.scratch/voxaction/issues/02-two-browsers-real-call.md`
**Commit:** 73cb834

## What was built

Real browser-to-browser audio between two participants, with the transcript still scripted. The
call is genuine; the words on screen are not yet.

- The signalling room, pure logic with no transport, so it can be tested directly.
- The signalling server, a thin WebSocket transport over that room.
- `WebRtcPeerManager`, the real implementation behind the existing `PeerManager` interface.
- A call timer, a visible link state, and the headphones warning in the interface.

## Timeline

| Time | Event |
|---|---|
| 19:14 | Wrote 9 failing tests for the signalling room. Confirmed they failed because the module did not exist. |
| 19:18 | Implemented the room. 20 of 20 tests passed, typecheck clean. |
| 19:19 | Pushed the repository to Hack-Co0ee/Sigzero. |
| 19:22 | Installed `ws`. Confirmed node 26 runs `.ts` files directly by stripping types. |
| 19:24 | Fixed three real type errors: a private field colliding with the `peers()` method, an unused field, and a missing signal kind. |
| 19:25 | Typecheck, build and tests all green. |
| 19:26 | Signalling verified with two real WebSocket clients: 10 of 10 checks. |
| 19:28 | Browser: headless Chromium denies the microphone. Granted it over CDP instead. |
| 19:30 | Two isolated browser sessions connected. Both reported two participants. |
| 19:35 | Found a join-order race: a peer that joins an empty room receives no offer if the second peer arrives while the first is reloading. |
| 19:38 | Feedback loop. Two participants on one machine with no audio isolation echoed the developer's own voice. Everything was stopped. |
| 19:41 | Re-verified sequentially with audio elements attached to the document. Both sides live. |

## Decisions

- **Signalling logic is separated from its transport.** The room is pure, so it is tested without a
  socket. This is why 9 tests exist for the part most likely to be broken.
- **A `present` signal was added.** A peer joining an empty room cannot know that somebody will
  later offer to it, so the server tells it when that happens.
- **Each remote track gets its own audio element.** Nothing is mixed. The element is attached to
  the document so playback can be inspected rather than assumed.
- **The failure path is visible.** With no microphone the interface shows a notice, and the
  transcript still runs, so the rest of the path remains demonstrable.

## Evidence

```
npm test                        4 files, 20 tests passed
npx tsc --noEmit                clean
npm run build                   37 modules, built
node server/verify-signal.mjs   10 of 10 checks passed
```

The signalling verification covers: first peer joining an empty room, a second peer seeing the
first, a third peer seeing both predecessors, an offer reaching exactly the named peer and not
echoing to the sender, an answer returning to the offerer, an ice candidate routing, and a goodbye
reaching the remaining peers.

Two isolated browser sessions both reported `participants 2`, `link connected`, and a live audio
track from the other side.

## Deferred

- Remote participants are named by their peer id. Real display names need the speaker carried in
  the signalling payload.
- The join-order race is a known issue, not fixed.
- The transcript is still scripted. T3 makes it real.

## Problems and corrections

- **Headless Chromium denies the microphone.** `Browser.grantPermissions` over CDP fixes it, and
  the devices are then present.
- **Feedback loop, and it echoed the developer's voice.** Two participants on one machine share one
  output device, so each microphone re-captured the other's playback. Everything was stopped: the
  audio elements were destroyed, both pages were moved to `about:blank` to release the microphones,
  and all three servers were killed. The rule is now recorded in `AGENTS.md` and in
  `skills/webrtc/SKILL.md`: verify a second participant by connection state and received track,
  never by listening.
- **Type errors from the first draft.** A private map named `peers` collided with the `peers()`
  method required by the interface, and a stored `local` field was never read.

## Corrections

An earlier revision of this record carried hand-written clock times that disagreed with the
git history, in one case placing completion before the start. The commit times are the
evidence; the step order is the narrative. `docs/TIMELINE.md` is generated from git and is
the authority for when.
