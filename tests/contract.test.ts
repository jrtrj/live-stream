import { describe, expect, it } from 'vitest'
import { IntentPayloadSchema, ModelReplySchema } from '../src/contract/payload'

describe('the contract rejects anything outside the closed verb list', () => {
  it('accepts the three payload shapes', () => {
    expect(IntentPayloadSchema.safeParse({ verb: 'SEND', item: 'brochure' }).success).toBe(true)
    expect(
      IntentPayloadSchema.safeParse({ verb: 'BOOK', when_text: 'Tuesday at 4', label: 'Call' })
        .success,
    ).toBe(true)
    expect(IntentPayloadSchema.safeParse({ verb: 'SHARE', code: 'KX-4471' }).success).toBe(true)
  })

  it('rejects a fourth verb, because a fourth verb is a scope change', () => {
    expect(IntentPayloadSchema.safeParse({ verb: 'PAY', amount: '50000' }).success).toBe(false)
  })

  it('rejects a model reply with no evidence quote', () => {
    const reply = { intents: [{ verb: 'SEND', item: 'brochure', confidence: 0.9 }] }
    expect(ModelReplySchema.safeParse(reply).success).toBe(false)
  })

  it('accepts an empty reply, because an empty reply is correct', () => {
    expect(ModelReplySchema.safeParse({ intents: [] }).success).toBe(true)
  })
})
