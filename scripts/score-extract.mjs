#!/usr/bin/env node
/**
 * score-extract.mjs — offline fixture scorer for the VoxAction intent extractor.
 *
 * No dependencies, no zod, plain Node. It:
 *   1. loads the JSONL fixture corpus,
 *   2. validates that every expected verb / item / when_text / code value occurs
 *      literally in that fixture's own text (fails loudly if not),
 *   3. replays every fixture through a pluggable extractor, and
 *   4. prints per-verb recall and precision plus the false-positive rate on the
 *      empty cases.
 *
 * Usage:
 *   node scripts/score-extract.mjs --mock
 *   node scripts/score-extract.mjs --extractor ./path/to/extractor.mjs
 *   node scripts/score-extract.mjs --mock --fixtures ./tests/fixtures/calls.jsonl
 *
 * A pluggable extractor module exports a default function (or `extract`) that
 * takes the fixture text and returns either an array of intents or a
 * { intents: [...] } reply. It may be async.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve, isAbsolute } from 'node:path'
import process from 'node:process'

const VERBS = ['SEND', 'BOOK', 'SHARE']
const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_FIXTURES = resolve(HERE, '..', 'tests', 'fixtures', 'calls.jsonl')

// ---------------------------------------------------------------- arguments

function parseArgs(argv) {
  const opts = { mock: false, extractor: null, fixtures: DEFAULT_FIXTURES, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--mock') opts.mock = true
    else if (a === '--help' || a === '-h') opts.help = true
    else if (a === '--extractor') opts.extractor = argv[++i]
    else if (a.startsWith('--extractor=')) opts.extractor = a.slice('--extractor='.length)
    else if (a === '--fixtures') opts.fixtures = argv[++i]
    else if (a.startsWith('--fixtures=')) opts.fixtures = a.slice('--fixtures='.length)
    else die(`unknown argument: ${a}`)
  }
  return opts
}

function die(message) {
  process.stderr.write(`error: ${message}\n`)
  process.exit(2)
}

// ------------------------------------------------------------------ loading

function loadFixtures(path) {
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch (err) {
    die(`cannot read fixtures at ${path}: ${err.message}`)
  }
  const cases = []
  raw.split('\n').forEach((line, idx) => {
    const trimmed = line.trim()
    if (!trimmed) return
    let obj
    try {
      obj = JSON.parse(trimmed)
    } catch (err) {
      die(`fixture line ${idx + 1} is not valid JSON: ${err.message}`)
    }
    if (typeof obj.text !== 'string' || obj.text.length === 0) {
      die(`fixture line ${idx + 1}: "text" must be a non-empty string`)
    }
    if (!Array.isArray(obj.expect)) {
      die(`fixture line ${idx + 1}: "expect" must be an array`)
    }
    cases.push({ line: idx + 1, text: obj.text, expect: obj.expect })
  })
  if (cases.length === 0) die(`no fixtures found in ${path}`)
  return cases
}

/**
 * Every expected value must be copied from the fixture's own text. A fixture
 * that expects an item the transcript never says is a broken fixture, not a
 * model failure, so this fails loudly instead of scoring.
 */
function checkConsistency(cases) {
  const violations = []
  for (const c of cases) {
    for (const exp of c.expect) {
      if (!exp || typeof exp !== 'object') {
        violations.push({ line: c.line, text: c.text, msg: `expect entry is not an object` })
        continue
      }
      if (!VERBS.includes(exp.verb)) {
        violations.push({
          line: c.line,
          text: c.text,
          msg: `expected verb ${JSON.stringify(exp.verb)} is not one of ${VERBS.join(', ')}`,
        })
        continue
      }
      // The verb token itself must appear in the text (speaker's own word).
      if (!c.text.toLowerCase().includes(exp.verb.toLowerCase())) {
        violations.push({
          line: c.line,
          text: c.text,
          msg: `expected verb "${exp.verb}" does not appear in the text`,
        })
      }
      // The copied fields must be literal substrings of the text.
      for (const key of ['item', 'when_text', 'code']) {
        const value = exp[key]
        if (value === undefined || value === null) continue
        if (typeof value !== 'string' || value.length === 0) {
          violations.push({
            line: c.line,
            text: c.text,
            msg: `expected ${exp.verb} ${key} must be a non-empty string, got ${JSON.stringify(value)}`,
          })
        } else if (!c.text.includes(value)) {
          violations.push({
            line: c.line,
            text: c.text,
            msg: `expected ${exp.verb} ${key} ${JSON.stringify(value)} is not a literal substring of the text`,
          })
        }
      }
    }
  }
  return violations
}

// ---------------------------------------------------------------- extractors

const MOCK_PATTERNS = [
  ['SEND', /\b(send|sending|sent)\b/i],
  ['BOOK', /\b(book|booking|reserve|reservation)\b/i],
  ['SHARE', /\b(share|sharing)\b/i],
]

/** A trivial built-in extractor: keyword presence, nothing clever. */
function mockExtractor(text) {
  const out = []
  for (const [verb, re] of MOCK_PATTERNS) {
    if (re.test(text)) {
      const m = re.exec(text)
      out.push({ verb, quote: m ? m[0] : '', confidence: 0.5 })
    }
  }
  return out
}

function normalizeReply(reply) {
  if (Array.isArray(reply)) return reply
  if (reply && Array.isArray(reply.intents)) return reply.intents
  return []
}

async function resolveExtractor(opts) {
  if (!opts.extractor) return { name: 'mock (built-in keyword matcher)', fn: mockExtractor }
  const path = isAbsolute(opts.extractor) ? opts.extractor : resolve(process.cwd(), opts.extractor)
  let mod
  try {
    mod = await import(pathToFileURL(path).href)
  } catch (err) {
    die(`cannot load extractor at ${path}: ${err.message}`)
  }
  const fn = mod.default || mod.extract || mod.score
  if (typeof fn !== 'function') {
    die(`extractor ${path} must export a default function (or "extract")`)
  }
  return {
    name: `${opts.extractor}`,
    fn: async (text) => normalizeReply(await fn(text)),
  }
}

// ---------------------------------------------------------------- scoring

function countByVerb(intents) {
  const counts = Object.fromEntries(VERBS.map((v) => [v, 0]))
  for (const it of intents) if (it && VERBS.includes(it.verb)) counts[it.verb] += 1
  return counts
}

async function score(extractor, cases) {
  const rows = []
  for (const c of cases) {
    let predicted
    try {
      predicted = normalizeReply(await extractor(c.text))
    } catch (err) {
      die(`extractor threw on fixture line ${c.line}: ${err.message}`)
    }
    rows.push({ case: c, expected: c.expect, predicted })
  }

  const perVerb = {}
  for (const verb of VERBS) {
    let expected = 0
    let predicted = 0
    let tp = 0
    for (const r of rows) {
      const e = countByVerb(r.expected)[verb]
      const p = countByVerb(r.predicted)[verb]
      expected += e
      predicted += p
      tp += Math.min(e, p)
    }
    const fp = predicted - tp
    const fn = expected - tp
    perVerb[verb] = {
      expected,
      predicted,
      tp,
      fp,
      fn,
      recall: expected === 0 ? null : tp / expected,
      precision: predicted === 0 ? null : tp / predicted,
    }
  }

  const emptyCases = rows.filter((r) => r.expected.length === 0)
  const firedOn = emptyCases.filter((r) => r.predicted.length > 0)
  const fpr = emptyCases.length === 0 ? 0 : firedOn.length / emptyCases.length

  return { rows, perVerb, emptyCases, firedOn, fpr }
}

// ------------------------------------------------------------------ report

function fmt(n) {
  return n === null ? '  n/a' : n.toFixed(3)
}

function pad(s, n) {
  s = String(s)
  return s.length >= n ? s : s + ' '.repeat(n - s.length)
}

function printReport(opts, extractorName, cases, result, violations) {
  const out = []
  out.push('VoxAction extraction fixture scorer')
  out.push(`fixtures : ${opts.fixtures}`)
  out.push(`extractor: ${extractorName}`)
  out.push(`cases    : ${cases.length}`)
  out.push('')

  if (violations.length > 0) {
    out.push(`fixture consistency: FAILED — ${violations.length} violation(s)`)
    for (const v of violations) {
      out.push(`  line ${v.line}: ${v.msg}`)
      out.push(`    text: ${v.text}`)
    }
    out.push('')
    out.push('refusing to score: fix the fixtures so every expected value is copied from its text.')
    process.stdout.write(out.join('\n') + '\n')
    process.exit(1)
  }
  out.push('fixture consistency: OK — every expected value is a literal substring of its own text')
  out.push('')

  out.push('per-verb results:')
  out.push(
    '  ' +
      pad('verb', 7) +
      pad('expected', 10) +
      pad('predicted', 11) +
      pad('TP', 5) +
      pad('FP', 5) +
      pad('FN', 5) +
      pad('recall', 9) +
      'precision',
  )
  for (const verb of VERBS) {
    const m = result.perVerb[verb]
    out.push(
      '  ' +
        pad(verb, 7) +
        pad(m.expected, 10) +
        pad(m.predicted, 11) +
        pad(m.tp, 5) +
        pad(m.fp, 5) +
        pad(m.fn, 5) +
        pad(fmt(m.recall), 9) +
        fmt(m.precision),
    )
  }
  out.push('')

  out.push(`empty cases (expect no intent): ${result.emptyCases.length}`)
  out.push(
    `  fired on ${result.firedOn.length}/${result.emptyCases.length}  false-positive rate ${result.fpr.toFixed(3)}`,
  )
  if (result.firedOn.length > 0) {
    for (const r of result.firedOn) {
      const verbs = r.predicted.map((p) => (p && p.verb) || '?').join(', ')
      out.push(`    line ${r.case.line}: predicted [${verbs}] for "${r.case.text}"`)
    }
  }
  process.stdout.write(out.join('\n') + '\n')
}

// -------------------------------------------------------------------- main

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    process.stdout.write(
      'usage: node scripts/score-extract.mjs [--mock] [--extractor <module.mjs>] [--fixtures <calls.jsonl>]\n',
    )
    return
  }

  const cases = loadFixtures(opts.fixtures)
  const extractor = await resolveExtractor(opts)
  const violations = checkConsistency(cases)

  // Run the extractor only if the fixtures are self-consistent; otherwise the
  // report is meaningless and we stop with a loud failure.
  const result = violations.length === 0 ? await score(extractor.fn, cases) : null
  printReport(opts, extractor.name, cases, result, violations)
}

main().catch((err) => die(err && err.stack ? err.stack : String(err)))
