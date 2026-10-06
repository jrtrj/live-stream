import type { CallEvent } from '../contract/events'
import type { EventStore } from './store'

export type EventHandler = (e: CallEvent) => void

/**
 * The single seam of the whole system.
 *
 * Audio, speech to text, extraction, dispatch, storage and the interface all
 * attach here. A later phase registers another publisher or subscriber. It does
 * not change the contract, and it does not reach into another module.
 */
export interface EventBus {
  publish(e: CallEvent): void
  subscribe(h: EventHandler): () => void
  all(): CallEvent[]
}

export function createEventBus(store?: EventStore): EventBus {
  const log: CallEvent[] = []
  const handlers = new Set<EventHandler>()

  return {
    publish(e: CallEvent): void {
      log.push(e)
      if (store) void store.append(e)
      for (const h of handlers) h(e)
    },
    subscribe(h: EventHandler): () => void {
      handlers.add(h)
      return () => {
        handlers.delete(h)
      }
    },
    all(): CallEvent[] {
      return log
    },
  }
}
