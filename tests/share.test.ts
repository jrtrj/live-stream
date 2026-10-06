import { describe, expect, it } from 'vitest'
import { isValidCode, shareHandler } from '../src/core/share.ts'
import type { IntentEvent } from '../src/contract/events.ts'

const shareIntent = (code: string): IntentEvent => ({
  type: 'intent',
  id: 'i1',
  speaker: { id: 'client', name: 'Client' },
  verb: 'SHARE',
  payload: { verb: 'SHARE', code },
  confidence: 0.92,
  evidence: `my reference is ${code}`,
  t_ms: Date.now(),
})

describe('what counts as a reference code', () => {
  it('accepts the codes people actually read out', () => {
    for (const code of ['8842', '4471', 'KX-4471', '12-34', 'kx-4471']) {
      expect(isValidCode(code), code).toBe(true)
    }
  })

  it('rejects a word, because a code is not a word', () => {
    // without a digit there is nothing to distinguish a code from ordinary speech
    for (const code of ['hello', 'the', 'brochure', 'reference']) {
      expect(isValidCode(code), code).toBe(false)
    }
  })

  it('rejects what cannot be read out loud and typed back', () => {
    for (const code of ['', '   ', 'a b', 'VX_19', 'VX/19', 'A'.repeat(24)]) {
      expect(isValidCode(code), JSON.stringify(code)).toBe(false)
    }
  })

  it('rejects something too short to be a reference', () => {
    // "the code is 1" is far more likely a mishearing than a real reference
    for (const code of ['1', '7', '12']) {
      expect(isValidCode(code), code).toBe(false)
    }
  })
})

describe('the SHARE handler', () => {
  it('fires and carries the code as the artefact', async () => {
    const action = await shareHandler(shareIntent('8842'))
    expect(action.status).toBe('fired')
    expect(action.artifact.kind).toBe('code')
    expect(action.artifact.ref).toBe('8842')
  })

  it('never alters the code it was given', async () => {
    // the verbatim gate already proved the code was said, so changing it here
    // would put something on the clipboard that nobody actually agreed to
    const action = await shareHandler(shareIntent('kx-4471'))
    expect(action.artifact.ref).toBe('kx-4471')
  })

  it('fails visibly when the code is not a code', async () => {
    const action = await shareHandler(shareIntent('brochure'))
    expect(action.status).toBe('failed')
    expect(action.error).toContain('brochure')
  })

  it('refuses an intent that is not a share', async () => {
    const send: IntentEvent = {
      ...shareIntent('8842'),
      verb: 'SEND',
      payload: { verb: 'SEND', item: 'brochure' },
    }
    const action = await shareHandler(send)
    expect(action.status).toBe('failed')
    expect(action.error).toContain('SHARE')
  })
})
