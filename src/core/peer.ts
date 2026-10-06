import type { Speaker } from '../contract/events'

/** One participant's audio track. 16 kHz mono PCM. */
export interface PeerSession {
  readonly speaker: Speaker
  close(): void
}

/**
 * Deliberately holds a LIST of peers from day one.
 *
 * A two-party call is the list containing one entry. A conference is one more
 * entry, so it is an implementation change and never a redesign.
 */
export interface PeerManager {
  readonly isConnected: boolean
  join(local: Speaker, onRemote: (peer: PeerSession) => void): Promise<void>
  peers(): PeerSession[]
  leave(): void
}

/** T1 fake: no audio yet, but the correct shape and identity. */
export class FakePeerManager implements PeerManager {
  private readonly list: PeerSession[] = []
  private connected = false

  constructor(private readonly remote: Speaker) {}

  get isConnected(): boolean {
    return this.connected
  }

  async join(_local: Speaker, onRemote: (peer: PeerSession) => void): Promise<void> {
    this.connected = true
    const peer: PeerSession = { speaker: this.remote, close: () => {} }
    this.list.push(peer)
    onRemote(peer)
  }

  peers(): PeerSession[] {
    return [...this.list]
  }

  leave(): void {
    this.connected = false
    this.list.length = 0
  }
}
