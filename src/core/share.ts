import type { ActionEvent, IntentEvent } from '../contract/events'
import type { ActionHandler } from './dispatcher'

/**
 * The shortest and longest a reference code can be.
 *
 * Below three characters there is nothing to distinguish a code from a
 * misheard word.
 */
const MIN_LENGTH = 3
const MAX_LENGTH = 16

/** Only what can be read out loud and typed back. */
const SHAPE = /^[A-Za-z0-9-]+$/

/** A code holds a digit. A word does not. */
const HAS_DIGIT = /\d/

/**
 * Is this something a person could read off one screen and type into another?
 *
 * A code that fails here is not copied, because copying the wrong string is
 * worse than copying nothing.
 */
export function isValidCode(code: string): boolean {
  return (
    code.length >= MIN_LENGTH &&
    code.length <= MAX_LENGTH &&
    SHAPE.test(code) &&
    HAS_DIGIT.test(code)
  )
}

/**
 * SHARE. Puts a reference code on the clipboard.
 *
 * The tap itself belongs to the interface, which owns the clipboard. This
 * handler decides only whether the code is worth copying.
 */
export const shareHandler: ActionHandler = async (intent: IntentEvent): Promise<ActionEvent> => {
  const failed = (error: string): ActionEvent => ({
    type: 'action',
    intent_id: intent.id,
    verb: intent.verb,
    status: 'failed',
    artifact: { kind: 'code', ref: '' },
    error,
    t_ms: Date.now(),
  })

  if (intent.payload.verb !== 'SHARE') {
    return failed(`the SHARE handler received a ${intent.verb} intent`)
  }

  const { code } = intent.payload

  // A code that does not look like one is far more likely to be a mishearing
  // than a real reference, so this fails visibly instead of copying it.
  if (!isValidCode(code)) {
    return failed(`"${code}" is not a code we can read back`)
  }

  // Passed through untouched. The verbatim gate already proved the code was
  // said, so changing it here would put something on the clipboard that nobody
  // actually agreed to.
  return {
    type: 'action',
    intent_id: intent.id,
    verb: 'SHARE',
    status: 'fired',
    artifact: { kind: 'code', ref: code },
    t_ms: Date.now(),
  }
}
