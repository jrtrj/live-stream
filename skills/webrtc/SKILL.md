---
name: voxaction-webrtc
description: Use when working on audio, signalling, or participants in VoxAction.
---

# Audio and participants

## The rule that matters most

**One audio channel per participant. Never a mixed stream.**

Each participant has their own microphone and their own track. The identity is
known because the producer sets it, so it is never inferred and no diarisation is
needed. This is the main technical advantage of owning both ends of the call: a
real telephone network mixes both parties into one stream, which is why
commercial call transcription must guess who spoke.

Build two audio graphs:

- one **mixed** graph for playback, because ears want the blend
- one graph **per participant** for transcription

Never route transcription audio through the mixer. Do not use
`MediaStreamAudioDestinationNode` to combine before transcribing.

## Headphones are mandatory

Separate channels give correct identities only when each microphone hears only its
own user. If two participants share a room on speakers, each microphone hears the
other speaker, and one sentence is transcribed twice under two different
identities. The receipt then contradicts itself.

Echo cancellation does not fix this. It cancels what a device plays, not a human
voice physically present in the room.

- Headphones on every participant: correct.
- Separate rooms: correct.
- One room on speakers: broken, and it looks like a model problem but is not.

## Never test two participants on one machine with playback on

This is the sharpest trap in the project, and it has already been triggered once.

Two browser sessions on one machine share one output device. Each session captures the
microphone, receives the other session's audio, and plays it through the speakers. The
microphone then hears that playback and sends it back. The result is a feedback loop that
echoes the user's own voice, and the pipeline genuinely re-captures it.

Rules:

- Verify a second participant by its **connection state** and its **received audio track**.
  Never by listening.
- When a second participant must exist on the same machine, do not attach audio output at all.
- If playback is required, use headphones, or virtual audio devices, or one participant only.

Echo cancellation does not save you here. It cancels what a device plays, and in this
configuration that playback is exactly what must not be re-captured.

## Mesh, not a server

There is no media server. Every participant connects to every other participant.

| Participants | Connections | Uplink at 32 kbps |
|---|---|---|
| 2 | 1 | 32 kbps |
| 3 | 3 | 64 kbps |
| 5 | 10 | 128 kbps |
| 12 | 66 | 352 kbps |

Audio is cheap. A video mesh fails at five participants because each client runs
several encoders and needs megabits of uplink. Voice has neither problem, so a
voice mesh is comfortable to about twelve participants. That is why no SFU is
needed at this size.

## Adding a participant is additive

`PeerManager` holds a list. A two-party call is the list containing one entry. A
third participant adds an entry and negotiates with the participants already
present. No redesign.

## Whisper pads to thirty seconds

This surprises people, and it decides the chunk size. Measured on the development
machine with `base.en` at int8 and four threads:

| Window | Compute for one call | Three speakers |
|---|---|---|
| 3 seconds | 1.30 s | fails |
| 5 seconds | about 1.35 s | tight |
| 10 seconds | about 1.45 s | works |

A three-second chunk costs almost what a fifteen-second file costs, so short
chunks buy latency by spending ten times the compute. Long windows are what let
one machine serve several speakers.

## When NAT blocks a direct path

A free TURN relay is available: Metered Open Relay, 20 GB per month, no card. A
negotiation that needs a relay costs roughly 20 to 40 milliseconds one way.
