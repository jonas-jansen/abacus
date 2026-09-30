import { describe, expect, it } from 'vitest'
import { eigenvalues, equilibria2, jacobian, spectralRadiusOf } from './linalg'

describe('eigenvalues of small matrices', () => {
  it('finds the Leslie example of the slides: three eigenvalues of modulus 3/∛50 (II 37)', () => {
    const L = [
      [0, 0, 9],
      [0.1, 0, 0],
      [0, 0.6, 0],
    ]
    const ls = eigenvalues(L)
    const r = 3 / Math.cbrt(50)
    for (const l of ls) expect(Math.hypot(l.re, l.im)).toBeCloseTo(r, 9)
    expect(ls.filter((l) => l.im === 0).map((l) => l.re)[0]).toBeCloseTo(r, 9)
    expect(spectralRadiusOf(L)).toBeCloseTo(r, 9)
  })

  it('finds the golden ratio for Fibonacci and the conserved total for the cancer model (II 20–24)', () => {
    const phi = (1 + Math.sqrt(5)) / 2
    expect(eigenvalues([[0, 1], [1, 1]]).map((l) => l.re)).toEqual([expect.closeTo(phi, 12), expect.closeTo(1 - phi, 12)])
    // column sums 1: λ = 1 is an eigenvalue and ρ = 1
    const A = [
      [0.997, 0.6, 0],
      [0.003, 0, 0.35],
      [0, 0.4, 0.65],
    ]
    expect(spectralRadiusOf(A)).toBeCloseTo(1, 10)
  })
})

describe('equilibria of planar systems', () => {
  it('finds the four states of the Lotka–Volterra example and their stability (IV 34–37)', () => {
    const f = ([n1, n2]: readonly number[]) => [(1 - (n1 + 2 * n2) / 1000) * n1, (1 - (n2 + n1) / 600) * n2]
    const eq = equilibria2(f, [[0, 1100], [0, 700]])
    expect(eq.map((e) => e.x.map((v) => Math.round(v)))).toEqual([[0, 0], [0, 600], [200, 400], [1000, 0]])
    expect(eq.map((e) => e.stable)).toEqual([false, true, false, true])
    const J = jacobian(f, [200, 400])
    expect(J[0][0]).toBeCloseTo(-1 / 5, 6)
    expect(J[0][1]).toBeCloseTo(-2 / 5, 6)
    expect(J[1][0]).toBeCloseTo(-2 / 3, 6)
  })

  it('finds the fixed points of the SIR map with R = 2,5: disease-free unstable, endemic stable (II 49–55)', () => {
    const N = 100_000
    const [a, g, b] = [0.1, 0.1, 5e-6]
    const f = ([s, i]: readonly number[]) => [s - b * s * i + a * (N - s), (1 - g - a) * i + b * s * i]
    const eq = equilibria2(f, [[0, N], [0, N]], 'map')
    expect(eq.map((e) => e.x.map((v) => Math.round(v)))).toEqual([[40_000, 30_000], [100_000, 0]])
    expect(eq.map((e) => e.stable)).toEqual([true, false])
  })
})

describe('period of an oscillation', () => {
  it('finds the period of a sine and of a spike train, and none for a damped decay', async () => {
    const { periodOf } = await import('./observables')
    const t = Float64Array.from({ length: 4001 }, (_, i) => i * 0.01)
    expect(periodOf(t, t.map((v) => Math.sin((2 * Math.PI * v) / 3.7)))!.period).toBeCloseTo(3.7, 3)
    expect(periodOf(t, t.map((v) => Math.exp(-v)))).toBeNull()
    const spikes = t.map((v) => ((v % 5) < 0.4 ? 100 : -80))
    expect(periodOf(t, spikes)!.period).toBeCloseTo(5, 1)
  })
})
