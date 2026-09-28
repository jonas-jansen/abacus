/**
 * Every registered applet must run at its defaults, and the answer key (§11.2) is
 * verified numerically here before it is written into pages.
 */

import { defaultParams, updateParams, type Observables } from '@abacus/applet-core'
import { describe, expect, it } from 'vitest'
import { applets, getApplet } from './index'
import { classify } from './linearsystem-phase'

describe('registry', () => {
  it.each(Object.keys(applets))('%s runs at its defaults and its displayed observables exist', (id) => {
    const def = applets[id]
    const run = def.model.run(defaultParams(def.model))
    expect(run.series.length + (run.grids?.length ?? 0)).toBeGreaterThan(0)
    for (const o of def.anzeige ?? []) expect(run.observables).toHaveProperty(o)
  })
})

const observe = (id: string, patch: Record<string, unknown>): Observables => {
  const { model } = getApplet(id)
  return model.run(updateParams(model, defaultParams(model), patch)).observables
}

describe('answer key (§11.2)', () => {
  it('logistic_a: fixed point stable below a = 3, 4-cycle after 1 + √6', () => {
    expect(observe('logistic-cobweb', { a: 2.95 }).periode.value).toBe(1)
    expect(observe('logistic-cobweb', { a: 3.05 }).periode.value).toBe(2)
    expect(observe('logistic-cobweb', { a: 1 + Math.sqrt(6) - 0.01 }).periode.value).toBe(2)
    expect(observe('logistic-cobweb', { a: 1 + Math.sqrt(6) + 0.01 }).periode.value).toBe(4)
  })

  it('behaviour is judged by the approach, not by a numerically settled tail', () => {
    expect(observe('logistic-cobweb', { a: 2.8, N: 5000 }).verhalten.value).toBe('oszillierend')
    expect(observe('logistic-cobweb', { a: 1.8, N: 5000 }).verhalten.value).toBe('monoton')
  })

  it('geometric: constant at a = 1, oscillating for negative a', () => {
    expect(observe('geometric', { a: 1 }).verhalten.value).toBe('monoton')
    expect(observe('geometric', { a: -0.5 }).verhalten.value).toBe('oszillierend')
  })

  it('log_IVP: inflection at x = K/2', () => {
    const { model } = getApplet('log-ivp')
    const p = updateParams(model, defaultParams(model), { r: 0.8, K: 50, x0: 2 })
    const t = model.run(p).observables.wendepunkt.value as number
    const x = (50 * 2) / (2 + 48 * Math.exp(-0.8 * t))
    expect(x).toBeCloseTo(25, 10)
  })

  it('linear system classification', () => {
    expect(classify(-1, 0.1)).toBe('stabiler Knoten')
    expect(classify(-1, 1)).toBe('stabiler Strudel')
    expect(classify(0, 1)).toBe('Zentrum')
    expect(classify(0.5, -1)).toBe('Sattel')
  })

  it('linear system rk45 matches the rotation solution for A = [[0, 1], [−1, 0]]', () => {
    const { model } = getApplet('linearsystem-phase')
    const p = updateParams(model, defaultParams(model), { a: 0, b: 1, c: -1, d: 0, start: [1, 0], T: 10 })
    const [y1] = model.run(p).series
    for (let i = 0; i < y1.x.length; i += 37) expect(y1.y[i]).toBeCloseTo(Math.cos(y1.x[i]), 5)
  })
})

const run = (id: string, patch: Record<string, unknown> = {}) => {
  const { model } = getApplet(id)
  return model.run(updateParams(model, defaultParams(model), patch))
}

describe('answer key, new applets (§11.2)', () => {
  it('newton_cooling: monotone below α = 1, oscillating up to α = 2, divergent beyond', () => {
    expect(observe('newton-cooling', { alpha: 0.9 }).verhalten.value).toBe('monoton')
    expect(observe('newton-cooling', { alpha: 1.5 }).verhalten.value).toBe('oszillierend')
    expect(observe('newton-cooling', { alpha: 1.5 }).grenzwert.value).toBe(23)
    expect(observe('newton-cooling', { alpha: 2.1 }).grenzwert.value).toBeNull()
  })

  it('logistic_rK: thresholds r = 1 and r = 2, for every K', () => {
    for (const K of [2, 5, 7.5]) {
      expect(observe('logistic-rk', { K, r: 0.9, N: 400 }).verhalten.value).toBe('monoton')
      expect(observe('logistic-rk', { K, r: 1.5, N: 400 }).verhalten.value).toBe('oszillierend')
      expect(observe('logistic-rk', { K, r: 1.95 }).periode.value).toBe(1)
      expect(observe('logistic-rk', { K, r: 2.05 }).periode.value).toBe(2)
    }
  })

  it('logistic_a: the bifurcation applet agrees with the cobweb one', () => {
    expect(observe('logistic-bifurcation', { a: 3.2 }).periode.value).toBe(2)
    expect(observe('logistic-bifurcation', { a: 3.5 }).periode.value).toBe(4)
    expect(observe('logistic-bifurcation', { a: 3.9 }).periode.value).toBeNull()
  })

  it('perturbation: a stable fixed point absorbs the kicks, an unstable one amplifies them', () => {
    expect(observe('logistic-perturbation', { a: 2.5 }).abweichung.value as number).toBeLessThan(0.03)
    expect(observe('logistic-perturbation', { a: 3.5 }).abweichung.value as number).toBeGreaterThan(0.1)
    // same seed, same sequence
    expect(run('logistic-perturbation', { a: 3.5 }).series[0].y).toEqual(run('logistic-perturbation', { a: 3.5 }).series[0].y)
  })

  it('predator_prey: the predator survives only for γ > 1', () => {
    expect(observe('predator-prey', { r: 1, gamma: 0.9, N: 400 }).raeuber.value).toBe('sterben aus')
    expect(observe('predator-prey', { r: 1, gamma: 1.5, N: 400 }).raeuber.value).toBe('überleben')
  })

  it('SIR: the epidemic takes off iff β x₁(0) > γ + α', () => {
    // threshold: β · 99 999 = γ + α = 0,2  ⇔  β ≈ 2,00002·10⁻⁶
    for (const [beta, out] of [
      [1.9e-6, 'stirbt aus'],
      [2.1e-6, 'bricht aus'],
    ] as const) {
      expect(observe('sir', { beta }).ausbruch.value).toBe(out)
      const I = run('sir', { beta }).series[1].y
      expect(I[1] > I[0]).toBe(out === 'bricht aus')
    }
  })

  it('numdiffsol: Euler has order 1, Heun order 2; Euler unstable for m < 4', () => {
    const [r1, r2] = observe('euler-heun', { m: 400 }).ordnung.value as number[]
    expect(Math.log2(r1)).toBeCloseTo(1, 1)
    expect(Math.log2(r2)).toBeCloseTo(2, 1)
    expect(observe('euler-heun', { m: 3 }).fehlerEuler.value as number).toBeGreaterThan(observe('euler-heun', { m: 4 }).fehlerEuler.value as number)
  })

  it('heron: correct digits roughly double per step', () => {
    const d = observe('heron', { x0: 1 }).stellen.value as number[]
    expect(d.slice(0, 5)).toEqual([0, 1, 2, 5, 11])
    expect(d[5]).toBeGreaterThanOrEqual(15) // machine precision
  })

  it('Michaelis–Menten: E + C and S + C + P are conserved', () => {
    const r = run('michaelis-menten', { k1: 100 })
    const [S, E, C, P] = r.series
    for (let i = 0; i < S.y.length; i += 50) {
      expect(E.y[i] + C.y[i]).toBeCloseTo(0.2, 6)
      expect(S.y[i] + C.y[i] + P.y[i]).toBeCloseTo(0.5, 6)
    }
    expect(r.meta.solver).toBe('rosenbrock')
  })

  it('discrete linear map: spectral radius < 1 means convergence to 0', () => {
    const r = run('linearsystem-discrete', { N: 200 })
    const [x1, x2] = r.series
    expect(Math.hypot(x1.y[200], x2.y[200])).toBeLessThan(1e-6)
    expect(observe('linearsystem-discrete', {}).verhalten.value).toBe('geht gegen 0')
  })
})
