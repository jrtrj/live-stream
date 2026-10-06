# AGENTS.md — VoxAction

Project-wide instructions for AI agents working in this repository.
Last updated: 2026-10-06 19:17 IST.

## IMPORTANT ! THIS IS THE MASTER RULE OVER ALL OTHER RULES

#### IN CASE OF ANY CONFLICT, AMBIGUITY, OR CONTROVERSY IN RULES, INSTRUCTIONS, OR THE CODE BASE - EXPLICITLY STATE IT. MAKE SURE THE DEVELOPER IS AWARE OF IT. IF THE DEVELOPER IGNORES YOUR STATEMENT, ASK AGAIN.

## Writing rules

1. **No word-fragment abbreviations.** Never write `cfg`, `msg`, `fn`, `tx`, `nav`, `pkg`, `repo`, `incl.`, or `approx.`. Write the whole word: configuration, message, function, transaction, navigation, package, repository, including, approximately.
2. **Established acronyms are allowed:** API, ASR, CLI, HTTP, ICE, JSON, LLM, PCM, README, RTC, SIP, SMS, STT, TURN, UI, URL, VAD, WebRTC.
3. **Identifiers, file paths, code, commands, and product names stay verbatim.** `faster-whisper`, `whisper-large-v3-turbo`, `base.en`, `lib/store.ts`, `npm test`, and `VoxAction` are not prose and must not be expanded.
4. **Documents use clear plain English.** Do not use compressed symbolic shorthand as prose, and do not use sentence fragments where a complete sentence is clearer.
5. **Commit messages, explanations, and code comments also use plain English.**

## Project facts

- VoxAction is an action layer for a phone line. During a live call, three spoken verbs become one-tap actions, and the call ends with a receipt of what was agreed.
- Built inside the Cooee hackathon window, 6-7 October 2026. Track: Real-Time Communication.
- **VoxAction is the project name. Sigzero is the team name**, and it is also the name of the
  organization repository that holds this work. A mismatch between the two is expected and is
  not a conflict.
- The design is `docs/DESIGN.html`. It holds the scope boundary, the free stack with measured numbers, the latency budget, the phases, and the rejected alternatives.
- **All code is written inside the window.** The rules forbid a pre-built or partially completed project. Decisions, accounts, and designs prepared beforehand are permitted and are recorded as such.

### Hard locks

- **Browser WebRTC carries the audio.** No media server. The mesh is deliberate, and an audio-only mesh holds to about twelve participants.
- **The verb list is closed at three:** `SEND`, `BOOK`, `SHARE`. A fourth verb is a scope change, not a feature.
- **The transcript is untrusted input.** A caller can say anything, including words that try to attack the system. The model may not write a URL, a phone number, an amount, or a resolved date.
- **The speaker is supplied, never inferred.** Each participant's own machine knows who is speaking, so no diarisation is performed.
- **One seam.** Three event types cross one event bus. A later phase adds a publisher or a subscriber. It never edits the contract.
- **Every capability sits behind an interface.** Swapping a fake for a real implementation happens in the composition root and nowhere else.
- **NEVER enable audio playback when two participants share one machine.** Two participants on
  one machine with one output device create a feedback loop: each session captures what the
  speakers play and sends it back. This was done once and it echoed the user's own voice. Verify a
  second peer by its connection state and its received track, never by listening. If playback is
  genuinely required, it must be one participant only, or headphones, or virtual audio devices.
- **Headphones are mandatory** for any two-participant test. Without acoustic isolation each microphone hears the other speaker, so one sentence is transcribed twice under two identities. Echo cancellation does not correct a voice physically present in the room.

### The frozen contract

`src/contract/events.ts` is frozen. `Speaker` is an identity, not a role. `PeerManager` holds a list of peers. Adding a participant is additive.

## Project Skills

Skills that apply across the project live in the `skills/` directory at the root. They are written in plain English so that any agent or coding assistant can use them.

- `skills/testing/SKILL.md` — the testing approach, the seam, and the commands.
- `skills/webrtc/SKILL.md` — the audio pipeline, the signalling flow, and the participant rules.

## Working agreements

1. **Consult before acting.** Ask before file edits that change behaviour, before commits, and before commands with side effects. Write files freely when the ticket already covers them.
2. **One coherent commit per ticket.** Documentation belongs in the same commit as the change it describes. If a file is missed, use `git commit --amend --no-edit` rather than adding a follow-up commit.
3. **Test first where a unit is testable.** Watch the test fail for the right reason before making it pass. Work that is deliberately deferred is recorded as deferred, never silently skipped.
4. **A code read is not verification.** Completion is proven by executed commands and their output. Cover the happy path and at least one failure path.
5. **No silent failures.** An error surfaces with a real status and message. It is never swallowed into a default.
6. **Do not widen scope.** If the ticket is wrong, or a real decision surfaces mid-build, stop and raise it.

## Mandatory uppercase file acknowledgment

Before making any change, the agent must read and acknowledge `AGENTS.md`, `DEVELOPMENT.md`, and the active ticket under `docs/tickets/`. State which files were read.

## Git practices

- The repository is local only during the window. No remote, no push.
- Commit messages use plain English and name the ticket, for example `T1: the ground — ...`.
- Never commit `node_modules/`, `dist/`, or any file holding a secret.
- `NODE_ENV=production` is set in this environment, so `npm install` omits every devDependency. Always install with `npm install --include=dev`.

## Ticket workflow

1. Read the ticket in `.scratch/voxaction/issues/`.
2. Read the matching implementation record in `docs/tickets/`.
3. Build, test, and verify.
4. Update the implementation record with timestamps and evidence.
5. Add an entry to `PROGRESS.md`.
6. Commit the code and the documentation together.
