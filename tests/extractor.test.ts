import { describe, expect, it } from 'vitest'
import { LlmExtractor, type ModelClient } from '../src/core/extractor.ts'
import type { TranscriptEvent } from '../src/contract/events.ts'

const speaker = { id: 'client', name: 'Client' }
const line = (text: string): TranscriptEvent => ({ type: 'transcript', speaker, text, t_ms: 1, final: true })

/** A stub model. It never touches the network, and it counts its calls. */
function stubClient(reply: string) {
  const state = { calls: 0, lastPrompt: '' }
  const client: ModelClient = {
    async complete(prompt: string) {
      state.calls += 1
      state.lastPrompt = prompt
      return reply
    },
  }
  return { client, state }
}

describe('the language model extractor', () => {
  it('turns a spoken request into an intent', async () => {
    const { client } = stubClient(
      JSON.stringify({
        intents: [{ verb: 'SEND', quote: 'send me the brochure', item: 'brochure', confidence: 0.92 }],
      }),
    )
    const extractor = new LlmExtractor(client)
    const out = await extractor.extract([line('send me the brochure')])
    expect(out).toHaveLength(1)
    expect(out[0].verb).toBe('SEND')
    expect(out[0].evidence).toBe('send me the brochure')
    expect(out[0].confidence).toBeCloseTo(0.92)
  })

  it('does not call the model at all when the filter finds no trigger', async () => {
    const { client, state } = stubClient('{"intents":[]}')
    const extractor = new LlmExtractor(client)
    const out = await extractor.extract([line('thanks, that all makes sense')])
    expect(out).toEqual([])
    expect(state.calls).toBe(0)
  })

  it('calls the model once when the filter finds a trigger', async () => {
    const { client, state } = stubClient('{"intents":[]}')
    const extractor = new LlmExtractor(client)
    await extractor.extract([line('can you send me the brochure')])
    expect(state.calls).toBe(1)
  })

  it('applies the gates to whatever the model returned', async () => {
    const { client } = stubClient(
      JSON.stringify({
        intents: [{ verb: 'SEND', quote: 'send me the invoice', item: 'brochure', confidence: 0.9 }],
      }),
    )
    const extractor = new LlmExtractor(client)
    expect(await extractor.extract([line('send me the brochure')])).toEqual([])
  })

  it('sends the prompt with the transcript window in it', async () => {
    const { client, state } = stubClient('{"intents":[]}')
    const extractor = new LlmExtractor(client)
    await extractor.extract([line('please send the brochure')])
    expect(state.lastPrompt).toContain('please send the brochure')
  })

  it('returns nothing and reports the reason when the model cannot be reached', async () => {
    const errors: string[] = []
    const broken: ModelClient = {
      async complete() {
        throw new Error('connection refused')
      },
    }
    const extractor = new LlmExtractor(broken, { onError: (m) => errors.push(m) })
    const out = await extractor.extract([line('please send me the brochure')])
    expect(out).toEqual([])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('connection refused')
  })

  it('keeps only the tail of a long call', async () => {
    const { client, state } = stubClient('{"intents":[]}')
    const extractor = new LlmExtractor(client, { window: 2 })
    await extractor.extract([line('EARLIEST-MARKER'), line('two'), line('send me the brochure')])
    expect(state.lastPrompt).not.toContain('EARLIEST-MARKER')
    expect(state.lastPrompt).toContain('send me the brochure')
  })
})
