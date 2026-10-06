import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { runGates } from '../src/core/gates.ts'

type Expect = { verb: string; item?: string; when_text?: string; label?: string; code?: string }
type Fixture = { text: string; expect: Expect[] }

const fixtures: Fixture[] = readFileSync(new URL('./fixtures/calls.jsonl', import.meta.url), 'utf8')
  .split('\n')
  .filter((line) => line.trim().length > 0)
  .map((line) => JSON.parse(line) as Fixture)

/** A reply built from what the fixture says the model should answer. */
const oracleReply = (fixture: Fixture): string =>
  JSON.stringify({
    intents: fixture.expect.map((e) => ({ ...e, quote: fixture.text, confidence: 0.9 })),
  })

describe('the gates against every fixture', () => {
  it('has fixtures to run', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(18)
  })

  it('accepts every intent an accurate model would produce', () => {
    const rejected: string[] = []
    for (const fixture of fixtures) {
      const got = runGates(oracleReply(fixture), fixture.text)
      if (got.length !== fixture.expect.length) {
        rejected.push(`${fixture.text.slice(0, 60)} -> got ${got.length}, want ${fixture.expect.length}`)
      }
    }
    // a gate that is too strict is as broken as one that is too loose
    expect(rejected).toEqual([])
  })

  it('accepts the empty cases as empty', () => {
    const empty = fixtures.filter((f) => f.expect.length === 0)
    expect(empty.length).toBeGreaterThanOrEqual(4)
    for (const fixture of empty) {
      expect(runGates('{"intents":[]}', fixture.text)).toEqual([])
    }
  })

  it('catches a model that fires a plausible SEND on every empty case', () => {
    const empty = fixtures.filter((f) => f.expect.length === 0)
    const survived: string[] = []
    for (const fixture of empty) {
      const hallucination = JSON.stringify({
        intents: [{ verb: 'SEND', quote: fixture.text, item: 'brochure', confidence: 0.99 }],
      })
      if (runGates(hallucination, fixture.text).length > 0) survived.push(fixture.text.slice(0, 60))
    }
    expect(survived).toEqual([])
  })

  it('rejects an invented code', () => {
    const reply = JSON.stringify({
      intents: [{ verb: 'SHARE', quote: 'share the reference code 8842', code: '1234', confidence: 0.9 }],
    })
    expect(runGates(reply, '[agent] sure, I will share the reference code 8842')).toEqual([])
  })

  it('rejects a resolved date and keeps the words instead', () => {
    const resolved = JSON.stringify({
      intents: [{ verb: 'BOOK', quote: 'book a slot for Tuesday at 4', when_text: '2026-10-13T16:00', label: 'slot', confidence: 0.9 }],
    })
    expect(runGates(resolved, '[client] book a slot for Tuesday at 4')).toEqual([])
  })

  it('rejects a SEND for something the application does not own', () => {
    const reply = JSON.stringify({
      intents: [{ verb: 'SEND', quote: 'send money to account 998877', item: 'money', confidence: 0.99 }],
    })
    expect(runGates(reply, '[client] send money to account 998877')).toEqual([])
  })
})
