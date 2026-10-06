import type { IntentEvent, TranscriptEvent } from '../contract/events'
import { runGates, shouldCallModel } from './gates'
import promptSource from '../../prompts/extract.txt?raw'

/** An intent before the pipeline assigns it an id and a timestamp. */
export type ExtractResult = Omit<IntentEvent, 'type' | 'id' | 't_ms'>

/** The model call, behind an interface so the extractor can be tested without one. */
export interface ModelClient {
  complete(prompt: string): Promise<string>
}

/**
 * Reads a window of transcript and returns zero or more intents.
 *
 * The implementation runs the cheap filter, then the model, then five
 * deterministic gates. The gates live inside the implementation, so this
 * interface never changes when the model or the provider does.
 */
export interface Extractor {
  extract(window: TranscriptEvent[]): Promise<ExtractResult[]>
}

export interface LlmExtractorOptions {
  /** How many trailing transcript lines to send. Bounds the token cost. */
  window?: number
  /** Called when the model cannot be reached. The failure is surfaced, not swallowed. */
  onError?: (message: string) => void
}

const WINDOW_MARKER = '========================= TRANSCRIPT WINDOW ========================='

/** The rule text of prompts/extract.txt, without its worked example window. */
function ruleText(): string {
  const cut = promptSource.indexOf(WINDOW_MARKER)
  return (cut >= 0 ? promptSource.slice(0, cut) : promptSource).trim()
}

function renderWindow(window: TranscriptEvent[]): string {
  return window.map((e) => `[${e.speaker.id}] ${e.text}`).join('\n')
}

function buildPrompt(transcript: string): string {
  return `${ruleText()}\n\n${WINDOW_MARKER}\n\n${transcript}\n`
}

/**
 * The real extractor. A language model classifies and copies; ordinary code
 * decides whether to believe it.
 */
export class LlmExtractor implements Extractor {
  private readonly windowSize: number
  private readonly onError?: (message: string) => void

  constructor(
    private readonly client: ModelClient,
    options: LlmExtractorOptions = {},
  ) {
    this.windowSize = options.window ?? 6
    this.onError = options.onError
  }

  async extract(window: TranscriptEvent[]): Promise<ExtractResult[]> {
    const tail = window.slice(-this.windowSize)
    if (tail.length === 0) return []

    const transcript = renderWindow(tail)

    // The filter. No trigger means the model is never called and the quota is
    // never spent.
    if (!shouldCallModel(transcript)) return []

    const speaker = tail[tail.length - 1].speaker

    let raw: string
    try {
      raw = await this.client.complete(buildPrompt(transcript))
    } catch (error) {
      // An unreachable model produces no intents. It must not throw into the
      // bus, and it must not be silent either, so the reason is reported.
      this.onError?.(`extraction failed: ${(error as Error).message}`)
      return []
    }

    return runGates(raw, transcript).map((gated) => ({ speaker, ...gated }))
  }
}

/**
 * One hardcoded phrase, so the pipeline can be demonstrated without a model or
 * a key. Kept because the app falls back to it when no key is configured.
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
