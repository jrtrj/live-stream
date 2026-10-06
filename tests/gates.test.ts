import { describe, expect, it } from 'vitest'
import { shouldCallModel, runGates, resolveItem } from '../src/core/gates.ts'

const window = `[client] send me the brochure and let us talk Tuesday at 4
[agent] sure, I will send the brochure now and share the reference code 8842`

describe('the cheap filter gates the model call', () => {
  it('skips filler that requests nothing', () => {
    expect(shouldCallModel('[client] thanks, that all makes sense')).toBe(false)
    expect(shouldCallModel('[agent] okay, sounds good to me')).toBe(false)
    expect(shouldCallModel('[client] where are you based these days?')).toBe(false)
  })

  it('passes a delivery request', () => {
    expect(shouldCallModel('[client] can you send me the brochure?')).toBe(true)
  })

  it('passes a commitment request', () => {
    expect(shouldCallModel('[client] lets book a slot for Tuesday at 4')).toBe(true)
  })

  it('passes on a code shape even without a verb word', () => {
    expect(shouldCallModel('[agent] the reference is KX-4471')).toBe(true)
  })

  it('passes on a spoken time even without a verb word', () => {
    expect(shouldCallModel('[client] how about next Friday instead')).toBe(true)
  })
})

describe('gate: the evidence quote must come from the transcript', () => {
  it('rejects a quote that is not in the window', () => {
    const reply = JSON.stringify({
      intents: [{ verb: 'SEND', quote: 'send me the invoice', item: 'brochure', confidence: 0.9 }],
    })
    expect(runGates(reply, window)).toEqual([])
  })

  it('accepts a quote that is in the window', () => {
    const reply = JSON.stringify({
      intents: [{ verb: 'SEND', quote: 'send me the brochure', item: 'brochure', confidence: 0.9 }],
    })
    expect(runGates(reply, window)).toHaveLength(1)
  })
})

describe('gate: every value must be copied verbatim', () => {
  it('rejects an item the speaker never said', () => {
    const reply = JSON.stringify({
      intents: [{ verb: 'SEND', quote: 'send me the brochure', item: 'contract', confidence: 0.9 }],
    })
    expect(runGates(reply, window)).toEqual([])
  })

  it('rejects a code the speaker never said', () => {
    const reply = JSON.stringify({
      intents: [{ verb: 'SHARE', quote: 'share the reference code 8842', code: '9999', confidence: 0.9 }],
    })
    expect(runGates(reply, window)).toEqual([])
  })

  it('accepts a code the speaker did say', () => {
    const reply = JSON.stringify({
      intents: [{ verb: 'SHARE', quote: 'share the reference code 8842', code: '8842', confidence: 0.9 }],
    })
    expect(runGates(reply, window)).toHaveLength(1)
  })
})

describe('gate: BOOK keeps the words, never a resolved date', () => {
  it('rejects a BOOK with no when_text', () => {
    const reply = JSON.stringify({
      intents: [{ verb: 'BOOK', quote: 'let us talk Tuesday at 4', label: 'call', confidence: 0.9 }],
    })
    expect(runGates(reply, window)).toEqual([])
  })

  it('rejects a BOOK whose when_text is a resolved date rather than the words', () => {
    const reply = JSON.stringify({
      intents: [{ verb: 'BOOK', quote: 'let us talk Tuesday at 4', when_text: '2026-10-13T16:00', label: 'call', confidence: 0.9 }],
    })
    expect(runGates(reply, window)).toEqual([])
  })

  it('keeps when_text as the words the speaker used', () => {
    const reply = JSON.stringify({
      intents: [{ verb: 'BOOK', quote: 'let us talk Tuesday at 4', when_text: 'Tuesday at 4', label: 'call', confidence: 0.9 }],
    })
    const out = runGates(reply, window)
    expect(out).toHaveLength(1)
    expect(out[0].payload).toEqual({ verb: 'BOOK', when_text: 'Tuesday at 4', label: 'call' })
  })
})

describe('gate: the payload must be complete for its verb', () => {
  it('rejects a SEND with no item', () => {
    const reply = JSON.stringify({
      intents: [{ verb: 'SEND', quote: 'send me the brochure', confidence: 0.9 }],
    })
    expect(runGates(reply, window)).toEqual([])
  })

  it('rejects a SHARE with no code', () => {
    const reply = JSON.stringify({
      intents: [{ verb: 'SHARE', quote: 'share the reference code 8842', confidence: 0.9 }],
    })
    expect(runGates(reply, window)).toEqual([])
  })
})

describe('gate: the catalogue is the boundary of what can be sent', () => {
  it('resolves an item the application owns', () => {
    expect(resolveItem('brochure')).toBeDefined()
    expect(resolveItem('the brochure')).toBeDefined()
  })

  it('does not resolve something the application does not own', () => {
    expect(resolveItem('money')).toBeUndefined()
    expect(resolveItem('secret')).toBeUndefined()
  })

  it('rejects a SEND for something not in the catalogue', () => {
    const reply = JSON.stringify({
      intents: [{ verb: 'SEND', quote: 'send me the money', item: 'money', confidence: 0.9 }],
    })
    expect(runGates(reply, `${window}\n[client] send me the money`)).toEqual([])
  })
})

describe('gate: the reply shape itself', () => {
  it('returns nothing for malformed JSON rather than throwing', () => {
    expect(runGates('not json at all', window)).toEqual([])
    expect(runGates('{"intents": [', window)).toEqual([])
  })

  it('tolerates a code fence around the JSON', () => {
    const fenced = '```json\n{"intents":[{"verb":"SHARE","quote":"share the reference code 8842","code":"8842","confidence":0.8}]}\n```'
    expect(runGates(fenced, window)).toHaveLength(1)
  })

  it('accepts an empty reply, because an empty reply is correct', () => {
    expect(runGates('{"intents":[]}', window)).toEqual([])
  })

  it('rejects a verb outside the closed list', () => {
    const reply = JSON.stringify({
      intents: [{ verb: 'PAY', quote: 'send me the brochure', confidence: 0.9 }],
    })
    expect(runGates(reply, window)).toEqual([])
  })

  it('rejects a reply with no evidence quote', () => {
    const reply = JSON.stringify({ intents: [{ verb: 'SEND', item: 'brochure', confidence: 0.9 }] })
    expect(runGates(reply, window)).toEqual([])
  })
})
