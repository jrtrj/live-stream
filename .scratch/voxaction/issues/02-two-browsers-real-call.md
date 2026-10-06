# 02: Two browsers on a real call

**What to build:** Two browser tabs join one call and hear each other. A scripted transcriber emits caption lines carrying the correct participant identity, so the whole audio-to-screen path is exercised before any real speech model exists.

**Blocked by:** T1

**Status:** ready-for-agent

- [ ] Two tabs connect over WebRTC and audio flows both ways
- [ ] A call timer runs and is visible
- [ ] Scripted captions appear attributed to the correct participant
- [ ] PeerManager holds a LIST of peers, not a single peer
- [ ] Headphone requirement is documented in the UI and the README
