import { describe, expect, it } from 'vitest'
import { createEventBus } from '../src/core/bus'
import { InMemoryStore } from '../src/core/store'
import type { TranscriptEvent } from '../src/contract/events'

const line = (text: string): TranscriptEvent => ({
  type: 'transcript',
  speaker: { id: 'client', name: 'Client' },
  text,
  t_ms: 1,
  final: true,
})

describe('the event bus is the one seam', () => {
  it('delivers every published event to every subscriber', () => {
    const bus = createEventBus()
    const seen: string[] = []
    bus.subscribe((e) => seen.push(e.type))
    bus.publish(line('hello'))
    bus.publish(line('again'))
    expect(seen).toEqual(['transcript', 'transcript'])
  })

  it('stops delivering after unsubscribe', () => {
    const bus = createEventBus()
    let count = 0
    const off = bus.subscribe(() => {
      count += 1
    })
    bus.publish(line('one'))
    off()
    bus.publish(line('two'))
    expect(count).toBe(1)
  })

  it('keeps the whole call in order', () => {
    const bus = createEventBus()
    bus.publish(line('first'))
    bus.publish(line('second'))
    expect(bus.all().map((e) => (e.type === 'transcript' ? e.text : e.type))).toEqual([
      'first',
      'second',
    ])
  })

  it('mirrors every event into the store', async () => {
    const store = new InMemoryStore()
    const bus = createEventBus(store)
    bus.publish(line('persisted'))
    await Promise.resolve()
    expect((await store.all()).length).toBe(1)
  })
})
