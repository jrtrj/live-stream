import type { Speaker } from '../contract/events'
import type { PeerManager, PeerSession } from './peer'

export interface WebRtcOptions {
  url: string
  room: string
  iceServers?: RTCIceServer[]
}

/**
 * The real PeerManager.
 *
 * One audio channel per participant. Every remote track becomes its own
 * PeerSession carrying the identity of whoever sent it, so the speaker is never
 * inferred and no diarisation is needed. Nothing here mixes the tracks.
 */
export class WebRtcPeerManager implements PeerManager {
  private readonly sessions = new Map<string, PeerSession>()
  private readonly connections = new Map<string, RTCPeerConnection>()
  private readonly queued = new Map<string, RTCIceCandidateInit[]>()
  private socket?: WebSocket
  private localStream?: MediaStream
  private announce?: (peer: PeerSession) => void
  private connected = false
  private lastError?: string

  constructor(private readonly options: WebRtcOptions) {}

  get isConnected(): boolean {
    return this.connected
  }

  get error(): string | undefined {
    return this.lastError
  }

  async join(local: Speaker, onRemote: (peer: PeerSession) => void): Promise<void> {
    this.announce = onRemote

    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })

    const peerId = `${local.id}-${Math.random().toString(36).slice(2, 8)}`
    const url = `${this.options.url}?room=${encodeURIComponent(this.options.room)}&peer=${peerId}`

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(url)
      this.socket = socket
      socket.onopen = () => resolve()
      socket.onerror = () => reject(new Error(`signalling socket failed: ${url}`))
      socket.onmessage = (event) => void this.handle(JSON.parse(String(event.data)))
    })
  }

  peers(): PeerSession[] {
    return [...this.sessions.values()]
  }

  leave(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ kind: 'bye' }))
    }
    for (const pc of this.connections.values()) pc.close()
    this.connections.clear()
    for (const session of this.sessions.values()) session.close()
    this.sessions.clear()
    if (typeof document !== 'undefined') {
      for (const el of document.querySelectorAll('audio[data-speaker]')) el.remove()
    }
    this.localStream?.getTracks().forEach((t) => t.stop())
    this.socket?.close()
    this.connected = false
  }

  private async handle(message: { kind: string; from?: string; others?: string[]; payload?: unknown }): Promise<void> {
    switch (message.kind) {
      case 'joined':
        // The joiner offers to everybody already present.
        for (const other of message.others ?? []) {
          await this.connect(other, true)
        }
        break
      case 'present':
        // Somebody arrived and will offer to us. Do nothing until they do.
        break
      case 'offer': {
        const from = message.from
        if (!from) return
        const pc = this.connect(from, false)
        const sdp = (message.payload as { sdp: RTCSessionDescriptionInit }).sdp
        await pc.setRemoteDescription(sdp)
        await this.flush(from)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        this.send({ kind: 'answer', to: from, payload: { sdp: pc.localDescription } })
        break
      }
      case 'answer': {
        const from = message.from
        if (!from) return
        const pc = this.connections.get(from)
        if (!pc) return
        const sdp = (message.payload as { sdp: RTCSessionDescriptionInit }).sdp
        await pc.setRemoteDescription(sdp)
        await this.flush(from)
        break
      }
      case 'ice': {
        const from = message.from
        if (!from) return
        const candidate = (message.payload as { candidate: RTCIceCandidateInit }).candidate
        const pc = this.connections.get(from)
        if (pc && pc.remoteDescription) await pc.addIceCandidate(candidate)
        else this.queued.set(from, [...(this.queued.get(from) ?? []), candidate])
        break
      }
      case 'bye': {
        const from = message.from
        if (!from) return
        this.connections.get(from)?.close()
        this.connections.delete(from)
        this.sessions.delete(from)
        this.connected = this.connections.size > 0
        break
      }
    }
  }

  private async flush(remoteId: string): Promise<void> {
    const pc = this.connections.get(remoteId)
    const queued = this.queued.get(remoteId) ?? []
    this.queued.delete(remoteId)
    for (const candidate of queued) await pc?.addIceCandidate(candidate)
  }

  private connect(remoteId: string, initiator: boolean): RTCPeerConnection {
    const existing = this.connections.get(remoteId)
    if (existing) return existing

    const pc = new RTCPeerConnection({ iceServers: this.options.iceServers ?? [] })
    this.connections.set(remoteId, pc)

    for (const track of this.localStream?.getTracks() ?? []) pc.addTrack(track, this.localStream!)

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.send({ kind: 'ice', to: remoteId, payload: { candidate: event.candidate.toJSON() } })
      }
    }

    // Each participant's audio arrives as its own track, never mixed.
    pc.ontrack = (event) => {
      const session: PeerSession = {
        speaker: { id: remoteId, name: remoteId },
        close: () => pc.close(),
      }
      this.sessions.set(remoteId, session)
      this.announce?.(session)
      // Attach the remote audio so it plays and so it can be inspected.
      // The element is never mixed with any other track: each participant keeps
      // their own stream all the way through.
      const audio = new Audio()
      audio.srcObject = event.streams[0] ?? new MediaStream([event.track])
      audio.autoplay = true
      audio.dataset.speaker = remoteId
      if (typeof document !== 'undefined') document.body.appendChild(audio)
      void audio.play().catch(() => {})
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') this.connected = true
      if (pc.connectionState === 'failed') this.lastError = `connection to ${remoteId} failed`
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        this.connected = [...this.connections.values()].some((p) => p.connectionState === 'connected')
      }
    }

    if (initiator) {
      void (async () => {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        this.send({ kind: 'offer', to: remoteId, payload: { sdp: pc.localDescription } })
      })()
    }

    return pc
  }

  private send(signal: { kind: string; to?: string; payload?: unknown }): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(signal))
  }
}
