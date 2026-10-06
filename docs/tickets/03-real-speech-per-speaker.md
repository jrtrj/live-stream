# T3 — Real speech, per speaker

**Status:** in progress
**Started:** 2026-10-06 19:22 IST
**Ticket:** `.scratch/voxaction/issues/03-real-speech-per-speaker.md` · GitHub #3

## What is built so far

The local speech-to-text service. A Transcriber implementation that calls it and wires into the
pipeline is still outstanding.

- `services/stt/server.py` — an HTTP service, standard library only, backed by `faster-whisper`
  `base.en` at int8 on four threads. The model loads and warms once at startup and never per
  request.
- `services/stt/selftest.py` — generates speech, posts the PCM, asserts non-empty text.
- `services/stt/README.md` — the run command, the contract, the measurements, and the traps.

## Evidence

Run command:

```
/home/loki/.hermes/bin/uv run --no-project --python 3.12 --with faster-whisper \
  --with "huggingface_hub<1" --with numpy python services/stt/server.py
```

Verified independently by the parent agent:

```
GET /health   {"status":"ok","model":"base.en","ready":true,"cold_load_seconds":0.831}
POST /transcribe?speaker=alice&t_ms=1000
  -> {"text":"and meet the brochure and let us talk to that for.", "inference_ms":1227.1}
wall clock: 1228.9 ms
PASS
```

Cold load 0.831 s, warm pass 0.744 s, inference 1227 ms for 3.83 s of audio.

## The finding that matters: `base.en` mangles the payload of BOOK

The spoken text was “send me the brochure and let us talk Tuesday at four”. The model returned
**“and meet the brochure and let us talk to that for.”**

Two errors in one sentence, and the second destroys the BOOK payload: `Tuesday at four` became
`to that for`. A date library cannot resolve that phrase, so the calendar event would be wrong or
absent.

This is the **second independent observation of the same failure**. The first was the parent
agent's benchmark, which also produced “talk to that for” from the same phrase. Two different
processes, two different clips, the same mishearing.

Both clips used synthesised speech, which is harder than natural speech in some places. The
comparison must be repeated on a real human recording before it is treated as final. But the
signal is strong enough to change the plan.

## Consequence for the plan

The design assumed local `base.en` could carry the live call and that the trade was latency. It is
not only latency. **`base.en` is not accurate enough for the phrases this demo depends on.**

Options, in order of preference:

1. **Run the demo on Groq `whisper-large-v3-turbo`** — a much larger model, and the reason it was
   the original choice. It costs the rate limits recorded in the design, and two speakers at
   three-second chunks exceed them, so eight-second windows are required.
2. **Record a real human clip of the demo script and measure both models on it** before deciding.
   This is cheap and should happen before Hour 16.
3. Keep `base.en` for the offline path only, and never claim it is the demo path.

## Deferred

- The `Transcriber` implementation that calls this service and publishes transcript events.
- The real recording comparison.
