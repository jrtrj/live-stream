# Local speech-to-text service

An HTTP service that transcribes one speaker's audio track with
`faster-whisper` `base.en`. The model is loaded and warmed once at startup, so
no request ever pays the model load cost. The speaker identity and the
start time arrive as query parameters; the service never infers the speaker.

## Run command

The dependencies and both version pins live in `pyproject.toml`, so there is
nothing to remember and no virtual environment to activate by hand:

```bash
cd services/stt
uv sync                 # once, creates .venv and uv.lock from pyproject.toml
uv run python server.py
```

`uv run` uses the project environment automatically. You never need to
`source .venv/bin/activate`; activating is only useful if you want an editor to
point at the interpreter.

The equivalent one-liner, if you would rather not have a local environment:

```bash
/home/loki/.hermes/bin/uv run --no-project --python 3.12 \
  --with faster-whisper --with "huggingface_hub<1" --with numpy \
  python services/stt/server.py
```

The service listens on `http://127.0.0.1:8756`. On startup it prints the cold
load time and the warm pass time, for example:

```
[stt] loading model base.en ...
[stt] model ready in 1.069 s cold, warm pass 0.751 s
[stt] listening on http://127.0.0.1:8756
```

## Request shape

`POST /transcribe?speaker=<identity>&t_ms=<integer>`

- The body is raw little-endian float32 PCM, 16 kHz, mono. There is no header
  or container.
- `speaker` is the identity of the person who spoke. It is supplied, never
  inferred.
- `t_ms` is the offset of this chunk in the call, in milliseconds.

## Response shape

```json
{"text": "Book the meeting for Tuesday at 4.", "speaker": "bob", "t_ms": 4200, "inference_ms": 1129.4}
```

- `text` is the transcript of this chunk.
- `speaker` and `t_ms` are echoed back unchanged.
- `inference_ms` is the inference time alone. It does not include the model
  load, which happened once at startup.

`GET /health` returns the model name, the ready state, and the cold load time:

```json
{"status": "ok", "model": "base.en", "ready": true, "cold_load_seconds": 1.069}
```

A bad request never fails silently. An empty body, a body whose length is not
a multiple of four bytes, or a non-integer `t_ms` returns `400` with an
`error` field.

## Worked `curl` example

Generate a clip, convert it to the wire format, and post it:

```bash
espeak-ng -v en-us -s 150 -w /tmp/clip.wav "book the meeting for Tuesday at four"

ffmpeg -hide_banner -loglevel error -i /tmp/clip.wav \
  -ac 1 -ar 16000 -f f32le -y /tmp/clip.f32

curl -s -X POST --data-binary @/tmp/clip.f32 \
  "http://127.0.0.1:8756/transcribe?speaker=bob&t_ms=4200"
```

Response observed on the development machine:

```json
{"text": "Book the meeting for Tuesday at 4.", "speaker": "bob", "t_ms": 4200, "inference_ms": 1129.4}
```

## Measured latency

Machine: Intel i5-8265U, 4 cores and 8 threads, no CUDA, 15 GB of memory, AVX2
but no AVX-512.

| Measurement | Value |
|---|---|
| Cold model load (`base.en`, int8, cached) | 1.069 s |
| Warm pass at startup | 0.751 s |
| Inference, 2.51 s clip | 1129.4 ms |
| Wall clock, 2.51 s clip (`curl`) | 1.131 s |
| Inference, 3.83 s clip (`selftest.py`) | 1965.3 ms |
| Wall clock, 3.83 s clip (`selftest.py`) | 1967.5 ms |

`Whisper` pads every input to thirty seconds, so the compute per call is close
to constant and a short chunk costs nearly what a long file costs. The inference
time is reported on every response so the budget can be watched in the call.

## Model choice and why

- `base.en`, device `cpu`, compute type `int8`, four threads.
- `small.en` was measured at 4.82 s for a three-second chunk on this machine,
  which is unusable for a live call. `base.en` is the largest English model
  that keeps inference near one to two seconds here.
- The `.en` variant is chosen because the service is English only, so there is
  no reason to pay for the multilingual decoder.
- `int8` and four threads match the four physical cores of the machine.

## Tooling traps on this machine

These were already diagnosed and are baked into the service. Do not
rediscover them.

1. `uv` is at `/home/loki/.hermes/bin/uv`. `PATH` is not inherited by
   background or non-login shells, so always call it by its absolute path.
2. `python3` is 3.14 and has no `pip` module. Use `uv` with `--python 3.12`.
3. `faster-whisper` 1.2.1 is incompatible with `huggingface_hub` 1.x, so pin
   `huggingface_hub<1`.
4. `faster-whisper` calls `av.open` with a `metadata_errors` argument that no
   PyAV version resolves here, so a file path crashes. The service avoids this
   by decoding the audio itself into a float32 numpy array and passing the
   array to `model.transcribe`. Never pass a file path or a stream.
5. `ffmpeg` is at
   `/home/loki/.hermes/tools/ffmpeg-9.0.1-linux-x64/bin/ffmpeg` when it is not
   already on `PATH`.

## Self test

`selftest.py` generates speech with `espeak-ng`, converts it to 16 kHz mono
float32 PCM, posts it to a running service, and asserts the returned text is
not empty. Run the service first, then:

```bash
/home/loki/.hermes/bin/uv run --no-project --python 3.12 \
  --with faster-whisper --with "huggingface_hub<1" --with numpy \
  python services/stt/selftest.py
```

Observed output:

```
health: {"status": "ok", "model": "base.en", "ready": true, "cold_load_seconds": 1.069}
sent 245424 bytes of PCM (61356 samples)
response: {"text": "and meet the brochure and let us talk to that for.", "speaker": "alice", "t_ms": 1000, "inference_ms": 1965.3}
wall clock: 1967.5 ms
PASS: transcript = 'and meet the brochure and let us talk to that for.'
```

The synthetic `espeak-ng` voice is imperfect, so the transcript is approximate.
The assertion is that the text is non-empty and that `speaker` and `t_ms`
survive the round trip.
