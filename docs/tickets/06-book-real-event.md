# T6 — BOOK creates a real calendar event

**Status:** complete
**Started:** 2026-10-06 20:55 IST
**Completed:** 2026-10-06 21:00 IST
**Ticket:** `.scratch/voxaction/issues/06-book-real-event.md` · GitHub #6

## What was built

A spoken time becomes a real calendar commitment, with no account, no OAuth and no stored
credential.

- **`src/core/when.ts`** — the resolver. Turns the speaker's own words into an instant, anchored to
  the moment they were spoken.
- **`src/core/calendar.ts`** — the BOOK handler, plus `calendarLink` and `toIcs`.
- **Wiring** — `dispatcher.register('BOOK', bookHandler)` in the composition root. One line, which
  is the whole integration the dispatcher was designed for.
- **The interface** shows the resolved words and an `Add to calendar →` link.

## Why the anchor matters

`Tuesday at 4` is meaningless on its own. The same words mean a different day depending on when the
call happened, so the resolver takes an anchor. The intent's own timestamp is used, because the
words were spoken a moment before the intent was made.

## The four traps, each measured first

Every rule in `when.ts` exists because a naive parse failed in a specific, observable way. All four
were measured against a real anchor before a line was written.

| Trap | What a naive parse does | The rule |
|---|---|---|
| Bare hour read as the small hours | `Tuesday at 4` becomes **04:00**, a 4am meeting | hour 1–7 with no `am`/`pm` becomes the afternoon |
| A weekday already gone | `Tuesday at 4` resolves to **last** Tuesday when the call is on Wednesday | re-read as the next occurrence |
| "Morning" read literally | `Monday morning` becomes **06:00** | `morning` 09:00, `afternoon` 14:00, `evening` 18:00, `night` 20:00 |
| Preferring the future everywhere | `this afternoon` is pushed to **tomorrow afternoon** | the tolerance applies only when the speaker pointed at today |

The last one is the subtle one. Preferring the future is not a blanket setting, so the resolver reads
plainly first and only re-reads forwards when the result is meaningfully behind us.

## Decisions

- **The model never produces a date.** T4's verbatim gate already rejects a resolved date, so this
  file is the only thing that can turn words into a time.
- **UTC with an explicit `Z` in both the link and the `ics`.** Writing a local wall-clock time with
  no timezone makes a calendar in another zone show the wrong **day**: a 16:00 IST booking renders as
  22:30 the previous evening in UTC.
- **Thirty minutes by default.** Nothing is ever said about duration, so the default is a decision
  rather than an accident.
- **An unresolvable time fails visibly.** The message names the words that could not be read, so the
  failure is diagnosable from the screen.
- **`chrono-node` is a new runtime dependency.** Natural-language date parsing is not worth
  hand-rolling and it cannot be done by the model. It is the project's fifth runtime dependency and
  was a deliberate choice, not a drift.

## Evidence

```
npm test                       9 files, 80 tests passed  (14 new for the resolver, 9 for the calendar)
npx tsc --noEmit               clean
```

In the browser, with `VITE_EXTRACTOR=scripted`, the scripted call renders two cards:

```
SEND | brochure         | "send me the brochure"        | failed — no handler registered for SEND
BOOK | Tuesday at 4     | "and let us talk Tuesday at 4" | fired | Add to calendar →
```

The link it produced, and what those dates decode to:

```
https://calendar.google.com/calendar/render?action=TEMPLATE&text=a+call
  &dates=20261013T103000Z/20261013T110000Z&details=Agreed+during+a+call...

start : Tue, 13 Oct 2026, 16:00 IST
end   : Tue, 13 Oct 2026, 16:30 IST
length: 30 minutes
```

`Tuesday at 4` spoken on a Wednesday afternoon resolved to **the next Tuesday at 16:00**, which is
the correct answer. The endpoint returns **HTTP 200** for that URL.

## The one step not verified

**The tap itself.** A signed-in Google account is needed to confirm the event lands in a real
calendar, and that cannot be done from here. What is verified is that the link is correctly formed,
that Google's endpoint accepts it, and that the times inside it are right. Somebody should tap it
once and confirm the event appears.

## Reconciliation with the design

The T4 record noted a deviation: the design lists gate 4 as *resolvable*, and T4 implemented
*required* instead, leaving resolution to this ticket. **That gap is now closed.** Resolution exists
and is tested, so section 04 of the design describes the current state.

## Deferred

- The `.ics` file is generated and tested but has no download control in the interface. The Google
  link is the primary path.
- A calendar link cannot be recalled once tapped, so a mistaken booking is corrected by the user,
  not by the system.
