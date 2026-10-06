import * as chrono from 'chrono-node'

/**
 * Turning the words the speaker used into a real time.
 *
 * The model never does this. It copies "Tuesday at 4" verbatim and this file
 * resolves it, anchored to the moment the words were spoken. A phrase like that
 * is meaningless without the anchor: the same words mean different days
 * depending on when the call happened.
 *
 * Everything here exists because a naive parse produces four specific failures,
 * each measured against the phrases this demo depends on.
 */

export interface Resolved {
  at: Date
  /** False when the speaker was vague. The interface can show that difference. */
  confident: boolean
}

/**
 * How far behind the anchor a time may sit and still be read as "today".
 *
 * This is deliberately not a blanket setting. Preferring the future everywhere
 * would push "this afternoon" to tomorrow afternoon, which is wrong. So the
 * tolerance applies only when the speaker pointed at today, and anything else
 * that lands in the past is read as the next occurrence.
 */
const TODAY_TOLERANCE_MS = 2 * 60 * 60 * 1000

/** How far ahead a commitment may reasonably be made. */
const MAX_AHEAD_MS = 30 * 24 * 60 * 60 * 1000

/** A digit followed by am or pm, in the spellings people actually use. */
const MERIDIEM = /\d[\s:.]*(am|pm)\b/i

/** The speaker pointed at today, so a near-past hour was probably meant. */
const POINTS_AT_TODAY = /\b(this|today|tonight|now)\b/i

const VAGUE = /\b(sometime|some time|whenever|soon|maybe|perhaps|later)\b/i

/**
 * The hour words, mapped to business hours.
 *
 * A bare "morning" parses to 06:00, which is not when anyone wants a meeting.
 * "4" parses to 04:00 for the same reason.
 */
const HOUR_WORDS: readonly [RegExp, number][] = [
  [/\bmorning\b/i, 9],
  [/\bafternoon\b/i, 14],
  [/\bevening\b/i, 18],
  [/\bnight\b/i, 20],
]

/** The small hours a bare number falls into when it meant the afternoon. */
const SMALL_HOURS_FROM = 1
const SMALL_HOURS_TO = 7
const AFTERNOON_SHIFT = 12

function adjustHour(text: string, date: Date): Date {
  // an explicit am or pm is the speaker's own answer, so leave it alone
  if (MERIDIEM.test(text)) return date

  const copy = new Date(date)

  for (const [pattern, hour] of HOUR_WORDS) {
    if (pattern.test(text)) {
      copy.setHours(hour, 0, 0, 0)
      return copy
    }
  }

  const hour = copy.getHours()
  if (hour >= SMALL_HOURS_FROM && hour <= SMALL_HOURS_TO) {
    copy.setHours(hour + AFTERNOON_SHIFT)
  }
  return copy
}

/**
 * Resolve the speaker's words, or return undefined.
 *
 * Undefined means the calendar ticket must not act. A guess here puts a wrong
 * invitation on somebody's calendar, so the only safe failure is to produce
 * nothing.
 */
export function resolveWhen(whenText: string, anchor: Date): Resolved | undefined {
  const text = whenText.trim()
  if (!text) return undefined

  const confident = !VAGUE.test(text)

  const first = chrono.parseDate(text, anchor)
  if (!first) return undefined
  let at = adjustHour(text, first)

  const tolerance = POINTS_AT_TODAY.test(text) ? TODAY_TOLERANCE_MS : 0

  if (at.getTime() < anchor.getTime() - tolerance) {
    // read the same words as the next occurrence instead
    const forward = chrono.parseDate(text, anchor, { forwardDate: true })
    if (!forward) return undefined
    at = adjustHour(text, forward)
  }

  // a commitment in the past cannot be kept, and one far in the future is
  // almost certainly a misreading. The same tolerance applies here, or a time
  // the speaker clearly meant for today would be rejected by this check after
  // having survived the one above.
  if (at.getTime() <= anchor.getTime() - tolerance) return undefined
  if (at.getTime() - anchor.getTime() > MAX_AHEAD_MS) return undefined

  return { at, confident }
}
