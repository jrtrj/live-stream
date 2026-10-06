import { describe, expect, it } from 'vitest'
import { resolveWhen } from '../src/core/when.ts'

/**
 * The anchor is the moment the words were spoken. A phrase like "Tuesday at 4"
 * is meaningless without it: the same words resolve differently depending on
 * when the call happened.
 *
 * Built in local time and asserted on local components, so the table holds on
 * any machine in any timezone.
 */
const ANCHOR = new Date(2026, 9, 7, 15, 30) // Wednesday 7 October 2026, 15:30 local

const local = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ` +
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

const at = (text: string): string => {
  const resolved = resolveWhen(text, ANCHOR)
  if (!resolved) throw new Error(`did not resolve: ${JSON.stringify(text)}`)
  return local(resolved.at)
}

describe('resolving the words into a real time', () => {
  it('moves a weekday that has already passed into the future', () => {
    // the anchor is a Wednesday, so this Tuesday is five days in the past
    expect(at('Tuesday at 4')).toBe('2026-10-13 16:00')
  })

  it('reads a bare afternoon hour as the afternoon, not the small hours', () => {
    // "at 4" means 16:00 in a business call, never 04:00
    expect(at('Tuesday at 4')).toBe('2026-10-13 16:00')
    expect(at('at 3')).toBe('2026-10-08 15:00')
  })

  it('leaves an explicit am or pm alone', () => {
    expect(at('Tuesday at 4pm')).toBe('2026-10-13 16:00')
    expect(at('tomorrow at 9am')).toBe('2026-10-08 09:00')
  })

  it('reads "morning" as a business hour, not six in the morning', () => {
    expect(at('Monday morning')).toBe('2026-10-12 09:00')
  })

  it('keeps a time later today, because today was meant', () => {
    // 14:00 is ninety minutes before the anchor, which is close enough to mean today
    expect(at('this afternoon')).toBe('2026-10-07 14:00')
  })

  it('handles a plain future day', () => {
    expect(at('tomorrow at 10')).toBe('2026-10-08 10:00')
  })

  it('handles a relative day', () => {
    expect(at('next Friday')).toBe('2026-10-16 12:00')
  })

  it('handles a relative offset', () => {
    expect(at('in an hour')).toBe('2026-10-07 16:30')
  })

  it('never returns a time in the past', () => {
    for (const phrase of ['Tuesday at 4', 'Monday morning', 'this morning', 'yesterday']) {
      const resolved = resolveWhen(phrase, ANCHOR)
      if (resolved) expect(resolved.at.getTime()).toBeGreaterThan(ANCHOR.getTime())
    }
  })
})

describe('what must be rejected rather than guessed', () => {
  it('rejects an empty phrase', () => {
    expect(resolveWhen('', ANCHOR)).toBeUndefined()
    expect(resolveWhen('   ', ANCHOR)).toBeUndefined()
  })

  it('rejects a phrase with no time in it at all', () => {
    expect(resolveWhen('sometime soon', ANCHOR)).toBeUndefined()
    expect(resolveWhen('whenever works', ANCHOR)).toBeUndefined()
  })

  it('rejects a bare day of the month, which the parser cannot place', () => {
    expect(resolveWhen('the 14th', ANCHOR)).toBeUndefined()
  })

  it('rejects a time absurdly far away', () => {
    expect(resolveWhen('2027-03-01', ANCHOR)).toBeUndefined()
  })

  it('reports a confident resolution separately from a vague one', () => {
    expect(resolveWhen('Tuesday at 4', ANCHOR)?.confident).toBe(true)
    expect(resolveWhen('sometime next week', ANCHOR)?.confident).toBe(false)
  })
})
