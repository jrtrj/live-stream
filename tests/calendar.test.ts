import { describe, expect, it } from 'vitest'
import { bookHandler, calendarLink, toIcs, DEFAULT_MINUTES } from '../src/core/calendar.ts'
import type { IntentEvent } from '../src/contract/events.ts'

const ANCHOR = new Date(2026, 9, 7, 15, 30) // Wednesday 7 October 2026, 15:30 local

const bookIntent = (whenText: string, label = 'a call'): IntentEvent => ({
  type: 'intent',
  id: 'i1',
  speaker: { id: 'client', name: 'Client' },
  verb: 'BOOK',
  payload: { verb: 'BOOK', when_text: whenText, label },
  confidence: 0.9,
  evidence: `let us talk ${whenText}`,
  // the anchor is the moment the intent was made, which is when the words were said
  t_ms: ANCHOR.getTime(),
})

/** Pull the two timestamps out of a calendar link. */
const timestamps = (link: string): string[] => {
  const dates = new URL(link).searchParams.get('dates') ?? ''
  return dates.split('/')
}

describe('the BOOK handler turns words into a real event', () => {
  it('resolves the words and produces a calendar link', async () => {
    const action = await bookHandler(bookIntent('Tuesday at 4'))
    expect(action.status).toBe('fired')
    expect(action.artifact.kind).toBe('calendar')
    expect(action.artifact.ref).toContain('calendar.google.com')
  })

  it('books a default duration rather than zero', async () => {
    const action = await bookHandler(bookIntent('Tuesday at 4'))
    const [start, end] = timestamps(action.artifact.ref)
    const minutes = (Date.parse(iso(end)) - Date.parse(iso(start))) / 60000
    expect(minutes).toBe(DEFAULT_MINUTES)
    expect(DEFAULT_MINUTES).toBe(30)
  })

  it('uses the words the speaker used as the event label', async () => {
    const action = await bookHandler(bookIntent('Tuesday at 4', 'slot'))
    const title = new URL(action.artifact.ref).searchParams.get('text')
    expect(title).toBe('slot')
  })

  it('reports the resolved time in an unambiguous form', async () => {
    const link = calendarLink({
      title: 'x',
      details: 'y',
      start: new Date(Date.UTC(2026, 9, 13, 10, 30)),
      end: new Date(Date.UTC(2026, 9, 13, 11, 0)),
    })
    const [start] = timestamps(link)
    expect(start).toBe('20261013T103000Z')
  })
})

/** The link carries compact UTC, which is not what Date.parse wants. */
function iso(compact: string): string {
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}T${compact.slice(9, 11)}:${compact.slice(11, 13)}:${compact.slice(13, 15)}Z`
}

describe('an event that cannot be placed is refused, never guessed', () => {
  it('fails visibly when the words hold no readable time', async () => {
    const action = await bookHandler(bookIntent('the 14th'))
    expect(action.status).toBe('failed')
    expect(action.error).toBeTruthy()
    // the message names the words, so the failure is diagnosable on screen
    expect(action.error).toContain('the 14th')
  })

  it('fails visibly for an empty timing', async () => {
    const action = await bookHandler(bookIntent('   '))
    expect(action.status).toBe('failed')
  })

  it('refuses an intent that is not a booking', async () => {
    const send: IntentEvent = {
      ...bookIntent('Tuesday at 4'),
      verb: 'SEND',
      payload: { verb: 'SEND', item: 'brochure' },
    }
    const action = await bookHandler(send)
    expect(action.status).toBe('failed')
    expect(action.error).toContain('BOOK')
  })
})

describe('the ics file', () => {
  it('writes the time in UTC so the day cannot shift', () => {
    const ics = toIcs({
      title: 'Call',
      details: 'evidence',
      start: new Date(Date.UTC(2026, 9, 13, 10, 30)),
      end: new Date(Date.UTC(2026, 9, 13, 11, 0)),
    })
    expect(ics).toContain('DTSTART:20261013T103000Z')
    expect(ics).toContain('DTEND:20261013T110000Z')
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
  })

  it('escapes the characters that would break the format', () => {
    const ics = toIcs({
      title: 'Call, with; punctuation',
      details: 'line one\nline two',
      start: new Date(Date.UTC(2026, 9, 13, 10, 30)),
      end: new Date(Date.UTC(2026, 9, 13, 11, 0)),
    })
    expect(ics).toContain('SUMMARY:Call\\, with\\; punctuation')
    expect(ics).toContain('DESCRIPTION:line one\\nline two')
  })
})
