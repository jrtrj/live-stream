/**
 * The signalling room.
 *
 * Pure logic with no network and no timers, so it can be tested directly. The
 * WebSocket server in `signal.ts` is a thin transport over this.
 *
 * Deliberately holds a list of members. A two-participant call is the list
 * holding two entries, and a conference is one more entry. Nothing here changes
 * when a participant is added.
 */

export type SignalKind = 'offer' | 'answer' | 'ice' | 'bye' | 'present'

export interface SignalIn {
  kind: SignalKind
  /** The intended recipient. Absent for `bye`, which goes to everybody else. */
  to?: string
  payload?: unknown
}

export interface SignalOut {
  from: string
  kind: SignalKind
  payload?: unknown
}

export interface JoinResult {
  self: string
  /** The participants already present. The joiner offers to each of them. */
  others: string[]
}

export interface Routed {
  to: string[]
  message: SignalOut
}

export interface Room {
  join(peerId: string): JoinResult
  leave(peerId: string): void
  route(from: string, signal: SignalIn): Routed
  peers(): string[]
}

export function createRoom(): Room {
  const members: string[] = []

  return {
    join(peerId: string): JoinResult {
      const others = members.filter((m) => m !== peerId)
      if (!members.includes(peerId)) members.push(peerId)
      return { self: peerId, others }
    },

    leave(peerId: string): void {
      const index = members.indexOf(peerId)
      if (index >= 0) members.splice(index, 1)
    },

    /**
     * A directed signal goes to exactly one participant. A goodbye goes to
     * everybody except the sender, because the sender already knows.
     */
    route(from: string, signal: SignalIn): Routed {
      let to: string[] = []
      if (signal.kind === 'bye') {
        to = members.filter((m) => m !== from)
      } else if (signal.to !== undefined) {
        to = members.filter((m) => m === signal.to)
      }

      const message: SignalOut = { from, kind: signal.kind }
      if (signal.payload !== undefined) message.payload = signal.payload

      return { to, message }
    },

    peers(): string[] {
      return [...members]
    },
  }
}
