/**
 * The model proxy.
 *
 * The browser must not hold an API key: anything compiled into the client is
 * readable by anyone who opens the page. So the browser posts the prompt here,
 * and this process adds the key and forwards to the provider.
 *
 *   MODEL_API_KEY=... node server/model.ts
 *
 * The upstream response is passed through unchanged, so the client keeps
 * speaking the ordinary OpenAI-compatible shape. With no key configured the
 * proxy refuses with 503 rather than calling upstream bare.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

const PORT = Number(process.env.MODEL_PORT ?? 8788)
const UPSTREAM = process.env.MODEL_URL ?? 'https://api.groq.com/openai/v1/chat/completions'
const API_KEY = process.env.MODEL_API_KEY ?? ''
const MODEL = process.env.MODEL ?? 'llama-3.3-70b-versatile'
const MAX_BODY = 200_000

function cors(response: ServerResponse): void {
  response.setHeader('access-control-allow-origin', '*')
  response.setHeader('access-control-allow-headers', 'content-type')
  response.setHeader('access-control-allow-methods', 'POST, OPTIONS')
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const parts: Buffer[] = []
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('body too large'))
        request.destroy()
        return
      }
      parts.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(parts).toString('utf8')))
    request.on('error', reject)
  })
}

createServer(async (request, response) => {
  cors(response)

  if (request.method === 'OPTIONS') {
    response.writeHead(204).end()
    return
  }
  if (request.method !== 'POST' || !request.url?.startsWith('/extract')) {
    response.writeHead(404, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'not found' }))
    return
  }
  if (!API_KEY) {
    response.writeHead(503, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'MODEL_API_KEY is not set' }))
    return
  }

  try {
    const body = JSON.parse(await readBody(request)) as { prompt?: string }
    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 400,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: body.prompt ?? '' }],
      }),
    })
    const text = await upstream.text()
    response.writeHead(upstream.status, { 'content-type': 'application/json' })
    response.end(text)
  } catch (error) {
    response.writeHead(502, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: String((error as Error).message ?? error) }))
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`model proxy listening on http://127.0.0.1:${PORT}/extract -> ${UPSTREAM}`)
})
