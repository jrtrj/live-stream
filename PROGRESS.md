# PROGRESS.md — VoxAction

The dated history of the build. Newest entry first. Each entry records what was
done, the evidence that proves it, and anything that was deferred.

---

## 2026-10-06 19:29 - Completed T2, two browsers on a real call

Real audio between two browser participants. The transcript is still scripted.

**Shipped**

- The signalling room as pure, tested logic, and a thin WebSocket server over it.
- `WebRtcPeerManager`, the real implementation behind the existing interface.
- A call timer, a visible link state, and the headphones warning in the interface.

**Evidence**

- `npm test` - 20 of 20 tests pass across 4 files.
- `node server/verify-signal.mjs` - 10 of 10 signalling checks pass with real clients.
- Two isolated browser sessions both reported two participants, a connected link, and a live
  audio track from the other side.

**Problems found and corrected**

- Three real type errors in the first draft: a private field collided with the `peers()` method
  required by the interface, an unused field, and a missing signal kind.
- Headless Chromium denies the microphone; `Browser.grantPermissions` over CDP fixes it.
- A join-order race: a peer that joins an empty room can receive no offer. Recorded as a known
  issue, not fixed.
- **A feedback loop echoed the developer's own voice.** Two browser participants on one machine
  share one output device, so each microphone re-captured the other's playback. Everything was
  stopped and the microphones were released. The rule is now in `AGENTS.md` and
  `skills/webrtc/SKILL.md`.

**Deferred**

- Real display names for remote participants.
- The transcript is still scripted; T3 makes it real.

**Next**

- T3, real speech per speaker.

---

## 2026-10-06 19:17 - Completed T1, the ground

Built the skeleton that every later ticket attaches to.

**Shipped**

- The frozen contract: three event types, `Speaker` as an identity, the closed
  verb list.
- The event bus, the only seam in the system.
- Five interfaces, each with a working fake behind it: `PeerManager`,
  `Transcriber`, `Extractor`, `Dispatcher`, `EventStore`.
- A scripted call that renders attributed captions and an action card.
- Eleven tickets, the design document, and the agent documentation.

**Evidence**

- `npm test` - 11 of 11 tests pass across 3 files.
- `npm run build` - clean typecheck, production build succeeds.
- Browser run: four captions with correct participant attribution, and one
  action card carrying its evidence quote. The dispatcher correctly reported
  `no handler registered for SEND`, which is the intended failure behaviour.

**Problems found and corrected**

- `npm install` silently installed only 4 packages. The cause was
  `NODE_ENV=production`, which makes npm omit devDependencies. Fixed with
  `--include=dev` and recorded in `DEVELOPMENT.md`.
- Typecheck failed on a version mismatch: `vitest` 2 ships its own copy of
  `vite`, which conflicts with `vite` 6. Upgraded to `vitest` 3.

**Deferred**

- Three workstreams were dispatched to subagents and were interrupted after
  seconds, producing nothing. The speech service, the prompt and fixtures, and
  the WebRTC spike remain outstanding.
- Deployment is not done. It needs a hosting account.

**Next**

- T2, the real two-tab call.
