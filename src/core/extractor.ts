import type { IntentEvent, TranscriptEvent } from '../contract/events'

/** An intent before the pipeline assigns it an id and a timestamp. */
export type ExtractResult = Omit<IntentEvent, 'type' | 'id' | 't_ms'>

/**
 * Reads a window of transcript and returns zero or more intents.
 *
 * The real implementation runs a language model and then five deterministic
 * gates. The gates live inside the implementation, so this interface never
 * changes when the model or the provider does.
 */
export interface Extractor {
  extract(window: TranscriptEvent[]): Promise<ExtractResult[]>
}

/**
 * T1 fake: one hardcoded phrase, so the path from speech to card can be
 * demonstrated before any model exists.
 */
export class FakeExtractor implements Extractor {
  async extract(window: TranscriptEvent[]): Promise<ExtractResult[]> {
    const last = window[window.length - 1]
    if (!last || !/brochure/i.test(last.text)) return []
    return [
      {
        speaker: last.speaker,
        verb: 'SEND',
        payload: { verb: 'SEND', item: 'brochure' },
        confidence: 0.9,
        evidence: last.text,
      },
    ]
  }
}
