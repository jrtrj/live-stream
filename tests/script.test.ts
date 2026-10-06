import { describe, expect, it } from 'vitest'
import { FakeTranscriber, SCRIPTED_TURNS, turnsFor } from '../src/core/transcriber.ts'
import { FakeExtractor } from '../src/core/extractor.ts'
import type { Speaker } from '../src/contract/events.ts'

const CLIENT: Speaker = { id: 'client', name: 'Client' }
const AGENT: Speaker = { id: 'agent', name: 'Agent' }

describe('the scripted call', () => {
  it('plays every line of the script, however long it grows', () => {
    // This is the test that was missing. The turn order was written out by hand
    // and stopped at four, so adding a fifth line to the script silently meant
    // that line never played -- and the action it demonstrates never fired.
    const turns = turnsFor(SCRIPTED_TURNS, CLIENT, AGENT)
    expect(turns).toHaveLength(SCRIPTED_TURNS.length)
  })

  it('alternates the speakers', () => {
    const turns = turnsFor(SCRIPTED_TURNS, CLIENT, AGENT)
    turns.forEach((speaker, i) => {
      expect(speaker).toBe(i % 2 === 0 ? CLIENT : AGENT)
    })
  })

  it('exercises every verb the product claims', async () => {
    // The demo is the strongest evidence we have. If the script stops covering a
    // verb, the demo is quietly weaker than the README says it is.
    const transcriber = new FakeTranscriber()
    const extractor = new FakeExtractor()
    const verbs = new Set<string>()

    for (const speaker of turnsFor(SCRIPTED_TURNS, CLIENT, AGENT)) {
      const line = await transcriber.transcribe(new Float32Array(0), speaker, Date.now())
      if (!line) continue
      for (const result of await extractor.extract([line])) verbs.add(result.verb)
    }

    expect([...verbs].sort()).toEqual(['BOOK', 'SEND', 'SHARE'])
  })

  it('speaks each line exactly once', async () => {
    const transcriber = new FakeTranscriber()
    const spoken: string[] = []
    for (const speaker of turnsFor(SCRIPTED_TURNS, CLIENT, AGENT)) {
      const line = await transcriber.transcribe(new Float32Array(0), speaker, Date.now())
      if (line) spoken.push(line.text)
    }
    expect(spoken).toEqual([...SCRIPTED_TURNS])
  })
})
