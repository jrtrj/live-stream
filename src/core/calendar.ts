import type { ActionEvent, IntentEvent } from '../contract/events'
import type { ActionHandler } from './dispatcher'
import { resolveWhen } from './when'

/**
 * Nothing is ever said about how long a meeting lasts, so the duration is a
 * decision rather than an accident. Thirty minutes is the shortest slot that is
 * still a real meeting.
 */
export const DEFAULT_MINUTES = 30

export interface CalendarEvent {
  title: string
  details: string
  start: Date
  end: Date
  uid?: string
}

/**
 * Compact UTC, the form both the `ics` file and the Google link expect:
 * `20261013T103000Z`.
 *
 * UTC with an explicit `Z` is deliberate. Writing a local wall-clock time with
 * no timezone makes a calendar in another zone show the wrong **day**, not just
 * the wrong hour: a 16:00 IST booking renders as 22:30 the previous evening in
 * UTC. UTC removes the ambiguity entirely.
 */
function utcCompact(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/**
 * A Google Calendar "add event" link. Tapping it opens a prefilled event, so a
 * single tap puts a real commitment in a real calendar without any account,
 * any OAuth flow, or any stored credential.
 */
export function calendarLink(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${utcCompact(event.start)}/${utcCompact(event.end)}`,
    details: event.details,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** Escape the characters that would otherwise break the format. */
function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** The same event as a downloadable calendar file. */
export function toIcs(event: CalendarEvent): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VoxAction//EN',
    'BEGIN:VEVENT',
    `UID:${event.uid ?? `voxaction-${event.start.getTime()}@voxaction`}`,
    `DTSTAMP:${utcCompact(new Date())}`,
    `DTSTART:${utcCompact(event.start)}`,
    `DTEND:${utcCompact(event.end)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(event.details)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

/**
 * BOOK. Turns the speaker's own words into a real commitment.
 *
 * The words were spoken a moment before the intent was made, so the intent's
 * own timestamp is the anchor. "Tuesday at 4" cannot be resolved without it.
 */
export const bookHandler: ActionHandler = async (intent: IntentEvent): Promise<ActionEvent> => {
  const failed = (error: string): ActionEvent => ({
    type: 'action',
    intent_id: intent.id,
    verb: intent.verb,
    status: 'failed',
    artifact: { kind: 'calendar', ref: '' },
    error,
    t_ms: Date.now(),
  })

  if (intent.payload.verb !== 'BOOK') {
    return failed(`the BOOK handler received a ${intent.verb} intent`)
  }

  const { when_text, label } = intent.payload
  const resolved = resolveWhen(when_text, new Date(intent.t_ms))

  // A guess here puts a wrong invitation in somebody's calendar, so an
  // unresolvable time produces a visible failure instead.
  if (!resolved) {
    return failed(`could not read a time from "${when_text}"`)
  }

  const start = resolved.at
  const end = new Date(start.getTime() + DEFAULT_MINUTES * 60_000)

  return {
    type: 'action',
    intent_id: intent.id,
    verb: 'BOOK',
    status: 'fired',
    artifact: {
      kind: 'calendar',
      ref: calendarLink({
        title: label,
        details: `Agreed during a call. Evidence: ${intent.evidence}`,
        start,
        end,
      }),
    },
    t_ms: Date.now(),
  }
}
