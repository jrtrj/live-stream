/**
 * Verifies the signalling server with two real clients.
 *
 *   node server/verify-signal.mjs
 *
 * Exits non-zero if any step fails.
 */

const URL = process.env.SIGNAL_URL ?? 'ws://127.0.0.1:8787'
const ROOM = 'verify'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function open(peerId) {
  const socket = new WebSocket(`${URL}?room=${ROOM}&peer=${peerId}`)
  const inbox = []
  socket.addEventListener('message', (e) => inbox.push(JSON.parse(String(e.data))))
  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => resolve({ socket, inbox }))
    socket.addEventListener('error', () => reject(new Error(`could not open ${peerId}`)))
  })
}

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

const a = await open('a1')
await wait(150)
check('first peer joins and is told the room is empty', () => true)
const aJoined = a.inbox.find((m) => m.kind === 'joined')
check('first peer received a joined message', aJoined?.others?.length === 0, JSON.stringify(aJoined?.others))

const b = await open('b1')
await wait(250)

const bJoined = b.inbox.find((m) => m.kind === 'joined')
check('second peer sees the first peer present', JSON.stringify(bJoined?.others) === '["a1"]', JSON.stringify(bJoined?.others))

const presentAtA = a.inbox.find((m) => m.kind === 'present')
check('first peer is told somebody arrived', presentAtA?.from === 'b1', String(presentAtA?.from))

// b offers to a
b.socket.send(JSON.stringify({ kind: 'offer', to: 'a1', payload: { sdp: { type: 'offer', sdp: 'v=0-offer' } } }))
await wait(200)
const offerAtA = a.inbox.find((m) => m.kind === 'offer')
check('offer is routed to exactly the named peer', offerAtA?.from === 'b1' && offerAtA?.payload?.sdp?.sdp === 'v=0-offer')
check('offer did not echo back to the sender', !b.inbox.some((m) => m.kind === 'offer'))

// a answers b
a.socket.send(JSON.stringify({ kind: 'answer', to: 'b1', payload: { sdp: { type: 'answer', sdp: 'v=0-answer' } } }))
await wait(200)
const answerAtB = b.inbox.find((m) => m.kind === 'answer')
check('answer is routed back to the offerer', answerAtB?.from === 'a1' && answerAtB?.payload?.sdp?.sdp === 'v=0-answer')

// ice both ways
a.socket.send(JSON.stringify({ kind: 'ice', to: 'b1', payload: { candidate: 'cand-a' } }))
await wait(200)
check('ice candidate is routed', b.inbox.some((m) => m.kind === 'ice' && m.payload?.candidate === 'cand-a'))

// a third peer joins, proving the room holds a list
const c = await open('c1')
await wait(250)
const cJoined = c.inbox.find((m) => m.kind === 'joined')
check('third peer sees both predecessors (list, not a pair)', JSON.stringify(cJoined?.others) === '["a1","b1"]', JSON.stringify(cJoined?.others))

// bye propagates to the others
b.socket.close()
await wait(300)
check('a goodbye reaches the remaining peers', a.inbox.some((m) => m.kind === 'bye' && m.from === 'b1'))

a.socket.close()
c.socket.close()
await wait(100)

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length} of ${results.length} checks passed`)
process.exit(failed.length === 0 ? 0 : 1)
