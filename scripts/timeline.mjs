/**
 * Generates docs/TIMELINE.md from the git history and the ticket records.
 *
 *   npm run timeline
 *
 * Hand-written timelines drift. This one is derived, so a reviewer can trust it
 * and regenerate it on any branch:
 *
 *   node scripts/timeline.mjs
 */

import { execSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const TICKET_DIR = 'docs/tickets'
const OUT = 'docs/TIMELINE.md'

const field = (text, name) => {
  const match = text.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*(.+)$`, 'm'))
  // records sometimes wrap values in backticks; strip them so the table is clean
  return match ? match[1].trim().replace(/^`|`$/g, '') : ''
}

const tickets = readdirSync(TICKET_DIR)
  .filter((f) => f.endsWith('.md'))
  .sort()
  .map((file) => {
    const text = readFileSync(join(TICKET_DIR, file), 'utf8')
    const title = (text.match(/^#\s+(.+)$/m) || [, file])[1]
    return {
      file,
      title: title.replace(/\s+—\s+/, ' — '),
      number: (file.match(/^(\d+)/) || [, '??'])[1],
      status: field(text, 'Status') || 'unknown',
      started: field(text, 'Started'),
      completed: field(text, 'Completed'),
      commit: field(text, 'Commit'),
    }
  })

const log = execSync("git log --pretty=format:'%h|%ad|%s' --date=format:'%Y-%m-%d %H:%M'", {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [hash, when, ...rest] = line.split('|')
    return { hash, when, subject: rest.join('|') }
  })

/** Which ticket a commit belongs to, from its subject. */
function ticketOf(subject) {
  if (subject.startsWith('docs:')) return '— documentation'
  if (subject.startsWith('T3 ') || subject.startsWith('T3:')) return '03 (service)'
  const match = subject.match(/^T(\d+)/)
  return match ? match[1].padStart(2, '0') : '—'
}

/**
 * git is the authority for when and which commit. A record can be stale or
 * wrong, so its declared times are compared against git and any disagreement
 * is reported rather than trusted.
 */
const commitsFor = (num) => log.filter((c) => new RegExp(`^T0?${Number(num)}(\\D|$)`).test(c.subject))
const drift = []
for (const t of tickets) {
  const mine = commitsFor(t.number)
  if (mine.length > 0) {
    const landed = mine[0] // newest first
    t.commit = landed.hash
    t.completedGit = landed.when
    const index = log.findIndex((c) => c.hash === landed.hash)
    t.startedGit = log[index + 1]?.when ?? ''
    if (t.started && t.completed && t.started > t.completed) {
      drift.push(`${t.number}: the record says it started at ${t.started}, after it finished at ${t.completed}`)
    }
    if (t.commit !== landed.hash && t.commitRaw) {
      drift.push(`${t.number}: the record cites ${t.commitRaw}, git says ${landed.hash}`)
    }
  }
}

const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).slice(0, 16)

const lines = []
lines.push('# TIMELINE.md — VoxAction')
lines.push('')
lines.push('Generated from the git history and the ticket records.')
lines.push('**Do not edit by hand.** Regenerate with `npm run timeline`.')
lines.push('')
lines.push(`Last generated: ${now} IST.`)
lines.push('')
lines.push('## Where the build stands')
lines.push('')
lines.push('| Ticket | Status | Started | Completed | Commit | Record |')
lines.push('|---|---|---|---|---|---|')
for (const t of tickets) {
  const finished = t.completedGit || t.completed || '—'
  const began = t.startedGit || t.started || '—'
  lines.push(
    `| ${t.number} | ${t.status} | ${began} | ${finished} | ${t.commit ? '`' + t.commit + '`' : '—'} | [${t.file}](tickets/${t.file}) |`,
  )
}
lines.push('')
lines.push('Times and commits in the table above come from git, not from the prose in the records.')
if (drift.length > 0) {
  lines.push('')
  lines.push('### Disagreements between a record and git')
  lines.push('')
  for (const d of drift) lines.push(`- ${d}`)
}
lines.push('')
lines.push('## Commit history')
lines.push('')
lines.push('| Time (IST) | Commit | Ticket | Summary |')
lines.push('|---|---|---|---|')
for (const c of log) {
  lines.push(`| ${c.when} | \`${c.hash}\` | ${ticketOf(c.subject)} | ${c.subject} |`)
}
lines.push('')
lines.push('## How to read this')
lines.push('')
lines.push('- Each ticket has one record under `docs/tickets/`. The record holds the decisions, the')
lines.push('  exact commands that were run, the output that proved the work, and anything deferred.')
lines.push('- The commit history above is the ground truth for *when*; the ticket records are the')
lines.push('  ground truth for *why*. Where they disagree, trust git.')
lines.push('- `PROGRESS.md` at the root is the narrative log, newest first.')
lines.push('- Known hazards and the review procedure are in `docs/REVIEWING.md`.')
lines.push('')

writeFileSync(OUT, lines.join('\n'))
console.log(`wrote ${OUT}`)
console.log(`  ${tickets.length} ticket records, ${log.length} commits`)
