import type { Speaker, TranscriptEvent } from '../contract/events'

/**
 * One call per chunk, per participant.
 *
 * The speaker arrives as an argument, because each participant's own machine
 * knows who is speaking. That is the whole reason no diarisation is needed.
 * A real implementation replaces this interface, not the pipeline.
 */
export interface Transcriber {
  transcribe(chunk: Float32Array, speaker: Speaker, t_ms: number): Promise<TranscriptEvent | null>
  warmup(): Promise<void>
}

export const SCRIPTED_TURNS = [
  'hi, we are looking at the enterprise plan',
  'good, let me walk you through it',
  'send me the brochure',
  'my reference is KX-4471',
  'and let us talk Tuesday at 4',
  'thanks, that is all I needed',
] as const

/**
 * One turn per scripted line, alternating between two speakers.
 *
 * Derived from the script rather than written out by hand. A hand-written order
 * stops covering the script the moment a line is added, and the line that falls
 * off the end is silently never spoken — so the action it demonstrates never
 * fires, and the demo is quietly weaker than it claims to be.
 */
export function turnsFor(lines: readonly string[], a: Speaker, b: Speaker): Speaker[] {
  return lines.map((_, i) => (i % 2 === 0 ? a : b))
}

/** T1 fake: ignores audio and replays a script, attributed to the caller. */
export class FakeTranscriber implements Transcriber {
  private i = 0

  constructor(private readonly lines: readonly string[] = SCRIPTED_TURNS) {}

  async warmup(): Promise<void> {}

  async transcribe(
    _chunk: Float32Array,
    speaker: Speaker,
    t_ms: number,
  ): Promise<TranscriptEvent | null> {
    const text = this.lines[this.i]
    if (text === undefined) return null
    this.i += 1
    return { type: 'transcript', speaker, text, t_ms, final: true }
  }
}
