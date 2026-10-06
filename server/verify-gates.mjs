/**
 * Verifies the model proxy chain without a language model and without a key.
 *
 *   node server/verify-gates.mjs
 *
 * A stub upstream stands in for the provider, so this proves the plumbing:
 * the proxy accepts the prompt, adds the key, forwards upstream, and passes the
 * reply back unchanged. The gate checks over the fixtures live in the test
 * suite, where the module resolver can reach src/.
 */

import { createServer } from 'node:http'
import { spawn } from 'node:child_process'

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

const CANNED = JSON.stringify({
  intents: [{ verb: 'SEND', quote: 'send me the brochure', item: 'brochure', confidence: 0.93 }],
})

/** Wait until a port answers, rather than guessing with a fixed sleep. */
async function ready(url, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      await fetch(url, { method: 'OPTIONS' })
      return true
    } catch {
      await new Promise((r) => setTimeout(r, 150))
    }
  }
  return false
}

/** Start a proxy and wait for it, reporting its output if it dies. */
async function startProxy(port, apiKey) {
  const child = spawn('node', ['server/model.ts'], {
    env: { ...process.env, MODEL_PORT: String(port), MODEL_URL: 'http://127.0.0.1:8799/chat', MODEL_API_KEY: apiKey },
  })
  let output = ''
  child.stdout?.on('data', (d) => { output += String(d) })
  child.stderr?.on('data', (d) => { output += String(d) })
  const up = await ready(`http://127.0.0.1:${port}/extract`)
  if (!up) console.log(`      proxy on ${port} never came up: ${output.trim().slice(0, 300)}`)
  return child
}

const stub = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ choices: [{ message: { content: CANNED } }] }))
})
await new Promise((r) => stub.listen(8799, '127.0.0.1', r))

// no key: the proxy must refuse rather than call upstream without one
const bare = await startProxy(8792, '')
const bareResponse = await fetch('http://127.0.0.1:8792/extract', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ prompt: 'hello' }),
})
check('the proxy refuses when no key is configured', bareResponse.status === 503, `status ${bareResponse.status}`)
bare.kill()

// with a key: the proxy forwards and passes the reply back
const proxy = await startProxy(8791, 'stub-key')

let status = 0
let content = ''
try {
  const response = await fetch('http://127.0.0.1:8791/extract', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'transcript:\n[client] send me the brochure' }),
  })
  status = response.status
  const body = await response.json()
  content = body?.choices?.[0]?.message?.content ?? ''
} catch (error) {
  console.log('      ' + String(error.message))
}

check('the proxy forwards and returns the upstream reply', status === 200 && content === CANNED, `status ${status}`)

const parsed = JSON.parse(content || '{"intents":[]}')
check('the reply the chain produced is a well formed reply', Array.isArray(parsed.intents) && parsed.intents.length === 1)

// the preflight the browser sends must be answered
const preflight = await fetch('http://127.0.0.1:8791/extract', { method: 'OPTIONS' })
check('the proxy answers the browser preflight', preflight.status === 204, `status ${preflight.status}`)

proxy.kill()
stub.close()

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length} of ${results.length} checks passed`)
process.exit(failed.length === 0 ? 0 : 1)
