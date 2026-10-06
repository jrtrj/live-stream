#!/usr/bin/env python3
"""Self test for the local speech-to-text service.

It generates speech with espeak-ng, converts it to 16 kHz mono float32 PCM,
posts the PCM to a running service, and asserts that the returned text is not
empty. It prints the transcript and the measured latency.

Run it with the same uv environment the service uses.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request

SERVICE_URL = "http://127.0.0.1:8756"
FFMPEG_FALLBACK = "/home/loki/.hermes/tools/ffmpeg-9.0.1-linux-x64/bin/ffmpeg"
SENTENCE = "send me the brochure and let us talk Tuesday at four"


def ffmpeg_path():
    found = shutil.which("ffmpeg")
    if found:
        return found
    if os.path.exists(FFMPEG_FALLBACK):
        return FFMPEG_FALLBACK
    raise RuntimeError("ffmpeg not found on PATH or at " + FFMPEG_FALLBACK)


def generate_pcm(sentence, scratch):
    """Return raw float32 little-endian PCM at 16 kHz mono for the sentence."""
    wav_path = os.path.join(scratch, "stt-selftest.wav")
    subprocess.run(
        ["espeak-ng", "-v", "en-us", "-s", "150", "-w", wav_path, sentence],
        check=True,
    )
    raw = subprocess.run(
        [
            ffmpeg_path(),
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            wav_path,
            "-ac",
            "1",
            "-ar",
            "16000",
            "-f",
            "f32le",
            "-",
        ],
        check=True,
        stdout=subprocess.PIPE,
    )
    return raw.stdout


def post_transcribe(base_url, pcm, speaker, t_ms):
    request = urllib.request.Request(
        base_url + "/transcribe?speaker=" + speaker + "&t_ms=" + str(t_ms),
        data=pcm,
        headers={"Content-Type": "application/octet-stream"},
        method="POST",
    )
    started = time.perf_counter()
    with urllib.request.urlopen(request, timeout=120) as response:
        payload = json.loads(response.read().decode("utf-8"))
    wall_ms = (time.perf_counter() - started) * 1000.0
    return payload, wall_ms


def wait_for_health(base_url, timeout_seconds=180):
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(base_url + "/health", timeout=5) as response:
                health = json.loads(response.read().decode("utf-8"))
            if health.get("ready"):
                return health
        except Exception:
            pass
        time.sleep(0.5)
    raise RuntimeError("service did not become ready within " + str(timeout_seconds) + " s")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default=SERVICE_URL)
    parser.add_argument("--scratch", default="/home/loki/.hermes/cache/scratch")
    args = parser.parse_args()

    os.makedirs(args.scratch, exist_ok=True)

    health = wait_for_health(args.url)
    print("health: " + json.dumps(health))

    sentence = os.environ.get("STT_SELFTEST_SENTENCE", SENTENCE)
    pcm = generate_pcm(sentence, args.scratch)
    print("sent " + str(len(pcm)) + " bytes of PCM (" + str(len(pcm) // 4) + " samples)")

    payload, wall_ms = post_transcribe(args.url, pcm, "alice", 1000)
    print("response: " + json.dumps(payload))
    print("wall clock: " + str(round(wall_ms, 1)) + " ms")

    text = payload.get("text", "")
    assert isinstance(text, str) and text.strip() != "", "expected non-empty transcript"
    assert payload.get("speaker") == "alice", "speaker must come back unchanged"
    assert payload.get("t_ms") == 1000, "t_ms must come back unchanged"
    assert isinstance(payload.get("inference_ms"), (int, float)), "inference_ms must be numeric"

    print("PASS: transcript = " + repr(text))
    return 0


if __name__ == "__main__":
    sys.exit(main())
