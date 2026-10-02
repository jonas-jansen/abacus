// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { last, publish, resetChannel, subscribe } from './index'

afterEach(resetChannel)

describe('channel', () => {
  it('delivers by topic and id, and retains the last message per id', () => {
    const a = vi.fn()
    const off = subscribe('applet/state', a, { id: 'x' })
    publish('applet/state', { applet: 'x', params: { a: 1 }, observables: {} })
    publish('applet/state', { applet: 'y', params: { a: 2 }, observables: {} })
    expect(a).toHaveBeenCalledTimes(1)
    off()
    expect(last('applet/state', 'y')?.params).toEqual({ a: 2 })
  })

  it('replays retained messages to late subscribers', () => {
    publish('quiz/result', { quiz: 'q', value: 3, status: 'correct' })
    const late = vi.fn()
    subscribe('quiz/result', late, { id: 'q' })
    expect(late).toHaveBeenCalledWith({ quiz: 'q', value: 3, status: 'correct' })
  })

  it('is observable from plain window listeners', () => {
    const seen = vi.fn()
    window.addEventListener('abacus:message', (e) => seen((e as CustomEvent).detail.topic))
    publish('applet/command', { applet: 'x', reset: true })
    expect(seen).toHaveBeenCalledWith('applet/command')
  })
})
