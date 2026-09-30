import { describe, expect, it } from 'vitest'
import { allowed, floored, magnification, MAX_ZOOM, panned, pinched, zoomedAbout, type Win } from './zoom'

const full: Win = { x: [0, 10], y: [0, 1] }

describe('zoom window', () => {
  it('zooms about the point under the pointer, which stays put', () => {
    const z = zoomedAbout(full, 2, 0.5, 0.5, 0.5, false)
    expect(z).toEqual({ x: [1, 6], y: [0.25, 0.75] })
    expect(magnification(full, z, false)).toBe(2)
  })

  it('zooms a log axis in decades', () => {
    const z = zoomedAbout({ x: [0, 1], y: [1e-4, 1] }, 0.5, 1e-2, 0.5, 1, true)
    expect(z.y[0]).toBeCloseTo(1e-3, 12)
    expect(z.y[1]).toBeCloseTo(1e-1, 12)
  })

  it('pans with the pointer and pinches about the first centre', () => {
    expect(panned(full, 40, 0, 400, 300, false).x).toEqual([-1, 9])
    const p = pinched(full, 5, 0.5, 0.5, 0, 0, 400, 300, false)
    expect(p).toEqual({ x: [2.5, 7.5], y: [0.25, 0.75] })
  })

  it('stays within the limits and above the floors', () => {
    expect(allowed(full, { x: [0, 10 / (MAX_ZOOM * 2)], y: [0, 1] }, false)).toBe(false)
    expect(allowed(full, { x: [0, 300], y: [0, 1] }, false)).toBe(false)
    expect(allowed(full, { x: [0, 100], y: [0, 1] }, false)).toBe(true)
    expect(floored({ x: [-2, 8], y: [-0.5, 0.5] }, { x: 0, y: 0 }, false)).toEqual({ x: [0, 10], y: [0, 1] })
    expect(floored({ x: [-2, 8], y: [-0.5, 0.5] }, { x: -Infinity, y: -Infinity }, false)).toEqual({ x: [-2, 8], y: [-0.5, 0.5] })
  })
})
