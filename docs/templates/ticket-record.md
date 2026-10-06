# Ticket record template

Copy this into `docs/tickets/<number>-<slug>.md` when a ticket starts, and
update it as the work proceeds. Record times as `YYYY-MM-DD HH:MM IST`.

---

# T<number> — <title>

**Status:** in progress | complete | deferred
**Started:** YYYY-MM-DD HH:MM IST
**Completed:** YYYY-MM-DD HH:MM IST
**Ticket:** `.scratch/voxaction/issues/<number>-<slug>.md`
**Commit:** `<hash>`

## What was built

The end-to-end behaviour this ticket made work.

## Timeline

| Time | Event |
|---|---|
| HH:MM | Started. |
| HH:MM | Wrote the failing test for ... |
| HH:MM | Implemented ... |
| HH:MM | Verified with ... |

## Decisions

Any decision taken during the build, with the reason. If a decision belongs in
the design document, say so and update it.

## Evidence

The exact commands and their output. A code read is not evidence.

## Deferred

Anything deliberately not done, and why.

## Problems and corrections

Anything that went wrong, and what fixed it.
