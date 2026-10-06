import type { ActionEvent, IntentEvent, Verb } from '../contract/events'

export type ActionHandler = (intent: IntentEvent) => Promise<ActionEvent>

/**
 * A registry, not a switch statement.
 *
 * BOOK and SHARE attach in their own tickets by registering here. Neither edits
 * this file, and neither edits the pipeline that calls it.
 */
export interface Dispatcher {
  register(verb: Verb, handler: ActionHandler): void
  has(verb: Verb): boolean
  dispatch(intent: IntentEvent): Promise<ActionEvent>
}

export function createDispatcher(): Dispatcher {
  const handlers = new Map<Verb, ActionHandler>()

  return {
    register(verb: Verb, handler: ActionHandler): void {
      handlers.set(verb, handler)
    },
    has(verb: Verb): boolean {
      return handlers.has(verb)
    },
    async dispatch(intent: IntentEvent): Promise<ActionEvent> {
      const handler = handlers.get(intent.verb)
      if (!handler) {
        return {
          type: 'action',
          intent_id: intent.id,
          verb: intent.verb,
          status: 'failed',
          artifact: { kind: 'code', ref: '' },
          error: `no handler registered for ${intent.verb}`,
          t_ms: Date.now(),
        }
      }
      return handler(intent)
    },
  }
}
