#!/usr/bin/env python3
"""Local HTTP speech-to-text service backed by faster-whisper `base.en`.

The service loads the model once at startup and warms it, so no request ever
pays the model load cost. The cold load time is measured and reported
separately from the per-request inference time.

The request body is raw little-endian float32 PCM at 16 kHz mono. The audio is
decoded into a numpy array and that array is handed to `model.transcribe`. A
file path is never passed, because faster-whisper reaches PyAV for file and
stream inputs and PyAV does not resolve on this machine.
"""

import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import numpy as np
from faster_whisper import WhisperModel

SAMPLE_RATE = 16000
MODEL_NAME = "base.en"
DEVICE = "cpu"
COMPUTE_TYPE = "int8"
CPU_THREADS = 4
HOST = "127.0.0.1"
PORT = int(os.environ.get("STT_PORT", "8756"))

_model = None
_ready = False
_cold_load_seconds = 0.0
_warm_seconds = 0.0
_infer_lock = threading.Lock()


def load_and_warm_model():
    """Load the model once, warm it once, and record both costs."""
    global _model, _ready, _cold_load_seconds, _warm_seconds

    started = time.perf_counter()
    _model = WhisperModel(
        MODEL_NAME,
        device=DEVICE,
        compute_type=COMPUTE_TYPE,
        cpu_threads=CPU_THREADS,
    )
    _cold_load_seconds = time.perf_counter() - started

    # Warm the encoder and decoder with one second of silence. The generator is
    # consumed so the work really happens; the text is discarded.
    warm_started = time.perf_counter()
    silence = np.zeros(SAMPLE_RATE, dtype=np.float32)
    _run_transcribe(silence)
    _warm_seconds = time.perf_counter() - warm_started

    _ready = True


def _run_transcribe(pcm):
    """Run one transcription and return the joined text."""
    segments, _info = _model.transcribe(
        pcm,
        language="en",
        beam_size=5,
        vad_filter=False,
        condition_on_previous_text=False,
    )
    return "".join(segment.text for segment in segments).strip()


def transcribe(pcm):
    """Guarded transcription: faster-whisper models are not thread-safe."""
    with _infer_lock:
        return _run_transcribe(pcm)


class Handler(BaseHTTPRequestHandler):
    server_version = "VoxActionSTT/1.0"

    def log_message(self, format, *args):
        print("[stt] " + (format % args), flush=True)

    def _send_json(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            self._send_json(
                200,
                {
                    "status": "ok" if _ready else "loading",
                    "model": MODEL_NAME,
                    "ready": _ready,
                    "cold_load_seconds": round(_cold_load_seconds, 3),
                },
            )
        else:
            self._send_json(404, {"error": "not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/transcribe":
            self._send_json(404, {"error": "not found"})
            return

        if not _ready:
            self._send_json(503, {"error": "model not ready"})
            return

        query = parse_qs(parsed.query)
        speaker = (query.get("speaker") or ["unknown"])[0]
        try:
            t_ms = int((query.get("t_ms") or ["0"])[0])
        except ValueError:
            self._send_json(400, {"error": "t_ms must be an integer"})
            return

        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            self._send_json(400, {"error": "Content-Length must be an integer"})
            return

        body = self.rfile.read(length) if length > 0 else b""
        if len(body) == 0 or len(body) % 4 != 0:
            self._send_json(
                400,
                {
                    "error": (
                        "body must be raw little-endian float32 PCM at 16 kHz "
                        "mono (a non-empty multiple of four bytes)"
                    )
                },
            )
            return

        pcm = np.frombuffer(body, dtype="<f4").astype(np.float32)

        started = time.perf_counter()
        try:
            text = transcribe(pcm)
        except Exception as exc:  # noqa: BLE001 - surfaced to the caller
            self._send_json(500, {"error": "transcription failed: " + str(exc)})
            return
        inference_ms = (time.perf_counter() - started) * 1000.0

        self._send_json(
            200,
            {
                "text": text,
                "speaker": speaker,
                "t_ms": t_ms,
                "inference_ms": round(inference_ms, 1),
            },
        )


def main():
    print("[stt] loading model " + MODEL_NAME + " ...", flush=True)
    load_and_warm_model()
    print(
        "[stt] model ready in "
        + str(round(_cold_load_seconds, 3))
        + " s cold, warm pass "
        + str(round(_warm_seconds, 3))
        + " s",
        flush=True,
    )
    try:
        server = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError as exc:
        # The most common way to hit this is starting the service twice. Say so
        # plainly instead of showing a raw traceback: the cost of the failure is
        # that the model was already loaded, and the fix is one command.
        if exc.errno == 98:
            print(
                "[stt] port "
                + str(PORT)
                + " is already in use, so another instance is running.",
                flush=True,
            )
            print(
                "[stt] either stop that one, or start this on another port:\n"
                "        STT_PORT=8757 uv run python server.py",
                flush=True,
            )
            raise SystemExit(1)
        raise
    print("[stt] listening on http://" + HOST + ":" + str(PORT), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
