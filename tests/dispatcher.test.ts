import { describe, expect, it } from 'vitest'
import { createDispatcher } from '../src/core/dispatcher'
import type { IntentEvent } from '../src/contract/events'

const intent = (verb: 'SEND' | 'BOOK' | 'SHARE'): IntentEvent => ({
  type: 'intent',
  id: 'i1',
  speaker: { id: 'client', name: 'Client' },
  verb,
  payload: { verb: 'SEND', item: 'brochure' },
  confidence: 0.9,
  evidence: 'send me the brochure',
  t_ms: 1,
})

describe('the dispatcher is a registry, not a switch', () => {
  it('reports a failure when no handler is registered, never a silent no-op', async () => {
    const d = createDispatcher()
    const result = await d.dispatch(intent('SEND'))
    expect(result.status).toBe('failed')
    expect(result.error).toContain('SEND')
  })

  it('runs the registered handler', async () => {
    const d = createDispatcher()
    d.register('SEND', async (i) => ({
      type: 'action',
      intent_id: i.id,
      verb: i.verb,
      status: 'fired',
      artifact: { kind: 'sms', ref: '+910000000000' },
      t_ms: 2,
    }))
    expect((await d.dispatch(intent('SEND'))).status).toBe('fired')
  })

  it('accepts handlers one at a time, so BOOK and SHARE attach without editing it', () => {
    const d = createDispatcher()
    expect(d.has('BOOK')).toBe(false)
    d.register('BOOK', async (i) => ({
      type: 'action',
      intent_id: i.id,
      verb: i.verb,
      status: 'fired',
      artifact: { kind: 'calendar', ref: '' },
      t_ms: 1,
    }))
    expect(d.has('BOOK')).toBe(true)
  })
})
