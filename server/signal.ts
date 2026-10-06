/**
 * The signalling server.
 *
 * A thin transport over `room.ts`, which holds all the logic and is tested
 * separately. Node runs this file directly; it strips the types itself.
 *
 *   node server/signal.ts
 */

import { WebSocketServer, type WebSocket } from 'ws'
import { createRoom, type SignalIn } from './room.ts'

const PORT = Number(process.env.SIGNAL_PORT ?? 8787)
const room = createRoom()
const bySocket = new Map<WebSocket, string>()
const byPeer = new Map<string, WebSocket>()

const wss = new WebSocketServer({ port: PORT })

function deliver(to: string[], from: string, signal: Omit<SignalIn, 'to'>): void {
  const message = JSON.stringify({ ...signal, from })
  for (const peerId of to) {
    const socket = byPeer.get(peerId)
    if (socket && socket.readyState === socket.OPEN) socket.send(message)
  }
}

wss.on('connection', (socket, request) => {
  const url = new URL(request.url ?? '/', 'http://localhost')
  const peerId = url.searchParams.get('peer') ?? `peer-${Math.random().toString(36).slice(2, 8)}`

  bySocket.set(socket, peerId)
  byPeer.set(peerId, socket)

  const { self, others } = room.join(peerId)
  socket.send(JSON.stringify({ kind: 'joined', self, others }))

  // Tell everyone already present that somebody arrived, so they can wait for
  // the offer rather than creating one themselves.
  deliver(others, self, { kind: 'present', payload: { self } })

  socket.on('message', (data) => {
    let signal: SignalIn
    try {
      signal = JSON.parse(String(data)) as SignalIn
    } catch {
      return
    }
    const { to } = room.route(peerId, signal)
    const { to: _ignored, ...rest } = signal
    deliver(to, peerId, rest)
  })

  socket.on('close', () => {
    const { to } = room.route(peerId, { kind: 'bye' })
    deliver(to, peerId, { kind: 'bye' })
    room.leave(peerId)
    bySocket.delete(socket)
    byPeer.delete(peerId)
  })
})

console.log(`signalling server listening on ws://127.0.0.1:${PORT}`)
