/**
 * The frozen contract.
 *
 * Three event types cross exactly one seam: the event bus. Every later phase
 * adds a publisher or a subscriber to that bus. No later phase edits this file.
 */

/**
 * A participant. An identity, not a role. A call may hold N of them, which is
 * why this is not `'agent' | 'client'`.
 */
export interface Speaker {
  id: string
  name: string
}

/** The closed verb list. A fourth verb is a scope change, not a feature. */
export type Verb = 'SEND' | 'BOOK' | 'SHARE'

export interface SendPayload {
  verb: 'SEND'
  item: string
}
export interface BookPayload {
  verb: 'BOOK'
  /** The words the speaker used. Never a resolved date. */
  when_text: string
  label: string
}
export interface SharePayload {
  verb: 'SHARE'
  code: string
}
export type IntentPayload = SendPayload | BookPayload | SharePayload

/** Event 1. One per participant track. The speaker is supplied, never inferred. */
export interface TranscriptEvent {
  type: 'transcript'
  speaker: Speaker
  text: string
  t_ms: number
  final: boolean
}

/** Event 2. Emitted only after all five gates pass. */
export interface IntentEvent {
  type: 'intent'
  id: string
  speaker: Speaker
  verb: Verb
  payload: IntentPayload
  confidence: number
  /** The exact transcript substring that caused this. Also the card evidence line. */
  evidence: string
  t_ms: number
}

/** Event 3. One per attempted action. */
export interface ActionEvent {
  type: 'action'
  intent_id: string
  verb: Verb
  status: 'pending' | 'fired' | 'failed'
  artifact: { kind: 'sms' | 'calendar' | 'code'; ref: string }
  error?: string
  t_ms: number
}

export type CallEvent = TranscriptEvent | IntentEvent | ActionEvent

export const VERBS: readonly Verb[] = ['SEND', 'BOOK', 'SHARE'] as const

export const isTranscript = (e: CallEvent): e is TranscriptEvent => e.type === 'transcript'
export const isIntent = (e: CallEvent): e is IntentEvent => e.type === 'intent'
export const isAction = (e: CallEvent): e is ActionEvent => e.type === 'action'
