import { z } from 'zod'

/** The payload shapes the application accepts. */
export const SendPayloadSchema = z.object({ verb: z.literal('SEND'), item: z.string().min(1) })
export const BookPayloadSchema = z.object({
  verb: z.literal('BOOK'),
  when_text: z.string().min(1),
  label: z.string().min(1),
})
export const SharePayloadSchema = z.object({ verb: z.literal('SHARE'), code: z.string().min(1) })

export const IntentPayloadSchema = z.discriminatedUnion('verb', [
  SendPayloadSchema,
  BookPayloadSchema,
  SharePayloadSchema,
])

/**
 * The only reply the model is allowed to produce.
 *
 * `quote` is mandatory: an intent that cannot cite the transcript is discarded.
 * There is deliberately no field for a URL, a phone number or an amount.
 */
export const ModelIntentSchema = z.object({
  verb: z.enum(['SEND', 'BOOK', 'SHARE']),
  quote: z.string().min(4),
  item: z.string().optional(),
  when_text: z.string().optional(),
  label: z.string().optional(),
  code: z.string().optional(),
  confidence: z.number().min(0).max(1),
})

export const ModelReplySchema = z.object({ intents: z.array(ModelIntentSchema) })

export type ModelIntent = z.infer<typeof ModelIntentSchema>
export type ModelReply = z.infer<typeof ModelReplySchema>
