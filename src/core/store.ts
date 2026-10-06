import type { CallEvent } from '../contract/events'

/**
 * The only storage seam.
 *
 * A plain array ships first. A Matrix room and a SQLite read model are later
 * implementations of this same interface, so neither choice forces an edit
 * anywhere else.
 */
export interface EventStore {
  append(e: CallEvent): Promise<void>
  all(): Promise<CallEvent[]>
}

export class InMemoryStore implements EventStore {
  private readonly log: CallEvent[] = []

  async append(e: CallEvent): Promise<void> {
    this.log.push(e)
  }

  async all(): Promise<CallEvent[]> {
    return [...this.log]
  }
}
