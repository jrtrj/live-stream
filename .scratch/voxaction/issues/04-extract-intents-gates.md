# 04: Extract intents, five gates, fixtures

**What to build:** Spoken requests become action cards, with deterministic validation before anything is shown. A fixture harness scores the extractor so the prompt can be tuned without a microphone.

**Blocked by:** T3

**Status:** ready-for-agent

- [ ] A request produces an intent event; silence produces none
- [ ] Gate rejects an intent whose evidence is not a substring of the transcript
- [ ] Gate rejects an item or code that is not verbatim in the transcript
- [ ] BOOK yields when_text, never a resolved date
- [ ] A regex filter suppresses the model call when no trigger is present
- [ ] Fixture harness reports per-verb precision and recall and the empty-case false-positive rate
