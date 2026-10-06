# Documentation

The written record of the build. Newest state first where it makes sense.
Last updated: 2026-10-06 20:45 IST.

| Path | Contents |
|---|---|
| `TIMELINE.md` | **Generated** from git and the ticket records: where each ticket stands, and every commit. Regenerate with `npm run timeline`. |
| `REVIEWING.md` | Start here to review. Commands, what is real against what is a mock, the seam, known hazards, and the branch conventions. |
| `DESIGN.html` | The full design: scope boundary, free stack with measured numbers, latency budget, phases, rejected alternatives. |
| `tickets/` | One implementation record per ticket: decisions, timeline, evidence, deferred work. |
| `templates/ticket-record.md` | The template every ticket record follows. |

At the repository root:

- `AGENTS.md` — the rules for agents: the master rule, writing rules, hard locks, working agreements.
- `DEVELOPMENT.md` — setup, structure, commands, and the measured facts.
- `PROGRESS.md` — the narrative log, newest entry first.

## Reading order for a new reviewer

1. `TIMELINE.md` for what has landed.
2. `REVIEWING.md` for how to run it and what to distrust.
3. The ticket record for whatever you are reviewing.
4. `DESIGN.html` for why the whole thing is shaped this way.
