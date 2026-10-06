import type { IntentEvent } from '../contract/events'
import { ModelReplySchema, type ModelIntent } from '../contract/payload'

/** A gated intent, before the pipeline gives it an id, a time and a speaker. */
export type GatedIntent = Omit<IntentEvent, 'type' | 'id' | 't_ms' | 'speaker'>

/**
 * What the application can actually deliver.
 *
 * This is the boundary of SEND. A caller can ask for anything; the application
 * can only send what it owns, so an item outside this table is rejected rather
 * than passed on. The model never supplies a URL.
 */
export const CATALOGUE: Record<string, string> = {
  brochure: 'https://voxaction.example/documents/brochure.pdf',
  contract: 'https://voxaction.example/documents/contract.pdf',
  invoice: 'https://voxaction.example/documents/invoice.pdf',
  receipt: 'https://voxaction.example/documents/receipt.pdf',
  'pricing sheet': 'https://voxaction.example/documents/pricing-sheet.pdf',
  deck: 'https://voxaction.example/documents/deck.pdf',
}

/** Resolve a spoken item name to something the application owns. */
export function resolveItem(raw: string): string | undefined {
  const key = raw.trim().toLowerCase().replace(/^the\s+/, '')
  return CATALOGUE[key]
}

/**
 * The cheap filter.
 *
 * One regular expression set stands in front of the language model. If the new
 * text carries no trigger, the model is never called, and the quota is not
 * spent. Real calls are mostly filler, so this is the largest single saving.
 */
const TRIGGERS: readonly RegExp[] = [
  /\b(send|share|email|mail|forward|deliver|whatsapp)\b/i,
  /\b(book|schedule|reschedule|meeting|appointment|slot|call me)\b/i,
  /\b(reference|ref|code|account|identifier|passcode)\b/i,
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\b(today|tomorrow|tonight|morning|afternoon|evening|next week|next month)\b/i,
  /\b\d{1,2}\s*(am|pm)\b/i,
  /\b\d{3,}\b/,
  /\b[A-Z]{1,4}-\d{2,}\b/,
]

export function shouldCallModel(text: string): boolean {
  return TRIGGERS.some((pattern) => pattern.test(text))
}

/** Strip a markdown code fence if the model added one despite being asked not to. */
function stripFence(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return (fenced ? fenced[1] : raw).trim()
}

function parseReply(raw: string) {
  try {
    const parsed = ModelReplySchema.safeParse(JSON.parse(stripFence(raw)))
    return parsed.success ? parsed.data : undefined
  } catch {
    return undefined
  }
}

/**
 * The five gates. A failure is a rejection, never a guess.
 *
 *   1 schema     the reply parses against the closed schema
 *   2 evidence   the quote is a literal substring of the transcript
 *   3 verbatim   every payload value is a literal substring of the transcript
 *   4 required   the payload is complete for its verb
 *   5 catalogue  a SEND names something the application owns
 *
 * Resolving when_text into a real date is deliberately not here. T4 keeps the
 * words the speaker used; the date library joins at the calendar ticket.
 */
export function runGates(raw: string, transcript: string): GatedIntent[] {
  const reply = parseReply(raw)
  if (!reply) return []

  const accepted: GatedIntent[] = []
  for (const intent of reply.intents) {
    const gated = gateOne(intent, transcript)
    if (gated) accepted.push(gated)
  }
  return accepted
}

function gateOne(intent: ModelIntent, transcript: string): GatedIntent | undefined {
  // gate 2 - the model must be able to point at the words that caused the match
  if (!transcript.includes(intent.quote)) return undefined

  // gate 3 - a value the speaker never said is a fabrication
  const verbatim = (value: string | undefined): boolean =>
    value !== undefined && transcript.includes(value)

  if (intent.verb === 'SEND') {
    // gate 4 - the payload must be complete
    if (!intent.item) return undefined
    // gate 3 - the item must be the speaker's own word
    if (!verbatim(intent.item)) return undefined
    // gate 5 - the application can only send what it owns
    if (!resolveItem(intent.item)) return undefined
    return {
      verb: 'SEND',
      payload: { verb: 'SEND', item: intent.item },
      confidence: intent.confidence,
      evidence: intent.quote,
    }
  }

  if (intent.verb === 'BOOK') {
    // gate 4 - a commitment with no timing is not a commitment
    if (!intent.when_text) return undefined
    // gate 3 - and the timing must be the speaker's words, never a resolved date
    if (!verbatim(intent.when_text)) return undefined
    return {
      verb: 'BOOK',
      // the label falls back to the words themselves, which are already verbatim
      payload: { verb: 'BOOK', when_text: intent.when_text, label: intent.label ?? intent.when_text },
      confidence: intent.confidence,
      evidence: intent.quote,
    }
  }

  // SHARE
  if (!intent.code) return undefined
  if (!verbatim(intent.code)) return undefined
  return {
    verb: 'SHARE',
    payload: { verb: 'SHARE', code: intent.code },
    confidence: intent.confidence,
    evidence: intent.quote,
  }
}
