import { describe, expect, it } from 'vitest'
import { createRoom } from '../server/room.ts'

describe('the signalling room', () => {
  it('tells the first participant that nobody is here yet', () => {
    const room = createRoom()
    expect(room.join('a')).toEqual({ self: 'a', others: [] })
  })

  it('tells a joining participant who is already present, so it can offer to them', () => {
    const room = createRoom()
    room.join('a')
    expect(room.join('b')).toEqual({ self: 'b', others: ['a'] })
  })

  it('holds a list, so three participants all coexist', () => {
    const room = createRoom()
    room.join('a')
    room.join('b')
    expect(room.join('c')).toEqual({ self: 'c', others: ['a', 'b'] })
    expect(room.peers().sort()).toEqual(['a', 'b', 'c'])
  })

  it('routes an offer to exactly the one named participant', () => {
    const room = createRoom()
    room.join('a')
    room.join('b')
    const routed = room.route('b', { kind: 'offer', to: 'a', payload: { sdp: 'x' } })
    expect(routed).toEqual({ to: ['a'], message: { from: 'b', kind: 'offer', payload: { sdp: 'x' } } })
  })

  it('routes an ice candidate to exactly the one named participant', () => {
    const room = createRoom()
    room.join('a')
    room.join('b')
    const routed = room.route('b', { kind: 'ice', to: 'a', payload: { candidate: 'c' } })
    expect(routed.to).toEqual(['a'])
    expect(routed.message.kind).toBe('ice')
  })

  it('routes a bye to everybody else, and never back to the sender', () => {
    const room = createRoom()
    room.join('a')
    room.join('b')
    room.join('c')
    const routed = room.route('b', { kind: 'bye' })
    expect(routed.to.sort()).toEqual(['a', 'c'])
  })

  it('routes nothing when the named participant has gone', () => {
    const room = createRoom()
    room.join('a')
    const routed = room.route('a', { kind: 'offer', to: 'ghost', payload: {} })
    expect(routed.to).toEqual([])
  })

  it('forgets a participant when it leaves', () => {
    const room = createRoom()
    room.join('a')
    room.join('b')
    room.leave('a')
    expect(room.peers()).toEqual(['b'])
    expect(room.route('b', { kind: 'offer', to: 'a', payload: {} }).to).toEqual([])
  })

  it('ignores a leave from a participant it never knew', () => {
    const room = createRoom()
    room.join('a')
    expect(() => room.leave('ghost')).not.toThrow()
    expect(room.peers()).toEqual(['a'])
  })
})
