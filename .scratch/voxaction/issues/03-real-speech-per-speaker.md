# 03: Real speech, per speaker

**What to build:** Each participant's own microphone is transcribed by a local faster-whisper service, and the resulting text is labelled with the participant who actually spoke. No diarisation anywhere.

**Blocked by:** T2

**Status:** ready-for-agent

- [ ] Speaking produces real text within a few seconds
- [ ] Each caption carries the correct speaker identity
- [ ] Transcription is per-track; no mixed stream is ever sent to the model
- [ ] The service bypasses PyAV and feeds float32 arrays
- [ ] Model is warmed before the call starts
