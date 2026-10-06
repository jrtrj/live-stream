# 01: The ground

**What to build:** A repository that runs, and the frozen seam every later ticket attaches to. The event contract is fixed, an event bus carries the three event types, and every capability exists as an interface with a working fake behind it. The page shows a call in progress and a caption stream.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `npm test` is green
- [ ] `npm run dev` serves a page that renders a caption stream from the bus
- [ ] `lib/contract/events.ts` exports the three event types and is frozen
- [ ] Fake implementations exist for PeerManager, Transcriber, Extractor and Dispatcher
- [ ] The design document is committed under `docs/`
