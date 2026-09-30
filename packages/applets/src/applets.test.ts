/**
 * Every registered applet must run at its defaults, and the answer key (§11.2) is
 * verified numerically here before it is written into pages.
 */

import { defaultParams, updateParams, type Observables } from '@abacus/applet-core'
import { describe, expect, it } from 'vitest'
import { applets, getApplet } from './index'
import { classify } from '@abacus/applet-core'

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
    // shown with whether it converges; a lasting 2-cycle does not
    const show = (o: { value: unknown; format?: (v: never) => string }) => o.format!(o.value as never)
    expect(show(observe('logistic-cobweb', { a: 2.8, N: 200 }).verhalten)).toBe('oszillierend konvergent')
    expect(show(observe('logistic-cobweb', { a: 1.8, N: 200 }).verhalten)).toBe('monoton konvergent')
    expect(show(observe('logistic-bifurcation', { a: 3.2, N: 200 }).verhalten)).toBe('oszillierend')
    expect(show(observe('geometric', { a: 1.2 }).verhalten)).toBe('monoton')
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

describe('horizon at its smallest', () => {
  it.each(Object.keys(applets).filter((id) => applets[id].horizont))('%s runs with the smallest allowed horizon', (id) => {
    const def = applets[id]
    const spec = def.model.params.find((s) => s.id === def.horizont)!
    const lows = [spec.kind === 'int' || spec.kind === 'real' ? spec.min : 1, (spec as { limits?: { min?: number } }).limits?.min ?? 0]
    for (const v of lows) {
      const p = updateParams(def.model, defaultParams(def.model), { [def.horizont!]: v })
      const run = def.model.run(p)
      expect(run.series.length).toBeGreaterThan(0)
      for (const s of run.series) expect(s.x.length).toBeGreaterThan(0)
    }
  })
})

describe('Anhang: the numbers are right', () => {
  it('ε–N: for 1/n and ε = 0,1 the sequence is in the band from n = 11 on', () => {
    expect(observe('folgen-grenzwert', { folge: 'inv', eps: 0.1 }).ab.value).toBe(11)
    expect(observe('folgen-grenzwert', { folge: 'quot', eps: 0.01 }).ab.value).toBe(200) // |2n/(n+1) − 2| = 2/(n+1) < 0,01 ⇔ n > 199
  })

  it('difference quotient of x² at 1 with h = 0,5 is 2,5; the derivative 2', () => {
    const o = observe('differenzenquotient', { f: 'x2', a: 1, h: 0.5 })
    expect(o.quotient.value).toBeCloseTo(2.5, 12)
    expect(o.ableitung.value).toBe(2)
  })

  it('Riemann: midpoint error shrinks like 1/n², left points like 1/n', () => {
    const e = (n: number, regel: string) => observe('riemann', { f: 'inv', a: 1, b: 2, n, regel }).fehler.value as number
    expect(e(10, 'mitte') / e(20, 'mitte')).toBeCloseTo(4, 1)
    expect(e(100, 'links') / e(200, 'links')).toBeCloseTo(2, 1)
    expect(observe('riemann', { f: 'inv', a: 1, b: 2 }).integral.value).toBeCloseTo(Math.LN2, 12)
  })

  it('linear system x₁ − 2x₂ = 1, 2x₁ + x₂ = 7 has the solution (3, 1); parallel lines none', () => {
    expect(observe('lgs', {}).loesung.value).toBe('(3; 1)')
    expect(observe('lgs', { a21: 2, a22: -4, b2: 5 }).art.value).toBe('keine (parallel)')
    expect(observe('lgs', { a21: 2, a22: -4, b2: 2 }).art.value).toBe('unendlich viele (dieselbe Gerade)')
  })

  it('eigenvector: (1, 1) is one for [[4, 1], [3, 2]], with λ = 5', () => {
    const o = observe('eigenvektoren', { v: [1, 1] })
    expect(o.eigen.value).toBe('ein Eigenvektor')
    expect(o.faktor.value).toBeCloseTo(5, 12)
    expect(observe('eigenvektoren', { v: [1, 0] }).eigen.value).toBe('kein Eigenvektor')
  })

  it('complex product: lengths multiply, angles add', () => {
    const o = observe('komplexe-zahlen', { op: 'produkt', z: [1, 1], w: [0, 2] })
    const [bz, bw, be] = o.betrag.value as number[]
    const [az, aw, ae] = o.winkel.value as number[]
    expect(be).toBeCloseTo(bz * bw, 12)
    expect(ae).toBeCloseTo(az + aw, 9)
  })

  it('fundamental theorem: F(x) for f(t) = t − 1 from 0 to 3 is 1,5', () => {
    expect(observe('hauptsatz', { f: 'lin', a: 0, x: 3 }).F.value).toBeCloseTo(1.5, 12)
  })
})

describe('zoomed detail', () => {
  it('the bifurcation diagram is recomputed for the visible range of a', () => {
    const { model } = getApplet('logistic-bifurcation')
    const r = model.run(defaultParams(model), { detail: { x: [3.55, 3.6], y: [0.5, 0.501], zoom: 1000 }, observables: false })
    const d = r.series.find((s) => s.id === 'diagramm')!
    let lo = Infinity
    let hi = -Infinity
    for (const a of d.x) [lo, hi] = [Math.min(lo, a), Math.max(hi, a)]
    expect(lo).toBeGreaterThanOrEqual(3.55)
    expect(hi).toBeLessThanOrEqual(3.6)
    // even a slice 0,001 high is filled: most values of a contribute many points
    // (periodic windows contribute nothing to such a thin slice; the chaotic band does)
    expect(d.x.length).toBeGreaterThan(12_000)
    for (const v of d.y) expect(v >= 0.5 && v <= 0.501).toBe(true)
  })
})

describe('answer key of the new applets (values from the slides)', () => {
  const szenario = (id: string, label: string) => {
    const def = getApplet(id)
    const s = def.szenarien!.find((x) => x.label === label)!
    return def.model.run({ ...defaultParams(def.model), ...s.params } as never).observables
  }

  it('Newton (I 64): from x₀ = 0,05 the digits double, x* = 0,265344933048…; the cycle and the runaway', () => {
    const o = szenario('newton', 'Folie 64')
    expect(o.nullstelle.value).toBeCloseTo(0.26534493304844, 12)
    expect((o.stellen.value as number[]).slice(0, 5)).toEqual([0, 1, 2, 4, 8])
    expect(szenario('newton', 'Zyklus').verhalten.value).toBe('Zyklus der Länge 2')
    expect(szenario('newton', 'läuft davon').verhalten.value).toBe('läuft davon')
  })

  it('discrete vs. continuous logistic (III 43–47): similar, 2-cycle, and the cycle from its start', () => {
    expect(szenario('logistic-vergleich', 'Folie 43').periode.value).toBe(1)
    expect(szenario('logistic-vergleich', 'Folie 45').periode.value).toBe(2)
    expect(szenario('logistic-vergleich', 'Folie 46').periode.value).toBe(2)
    expect(szenario('logistic-vergleich', 'Folie 44').periode.value).toBeNull()
  })

  it('Leslie (II 29–37): ρ = 3/∛50 < 1, dies out; b₃ = 20 grows', () => {
    expect(szenario('leslie', 'Folie 29').rho.value).toBeCloseTo(3 / Math.cbrt(50), 9)
    expect(szenario('leslie', 'Folie 29').zukunft.value).toBe('stirbt aus')
    expect(szenario('leslie', 'wächst').zukunft.value).toBe('wächst')
  })

  it('cancer model (II 20–24): N is conserved, the stationary state sums to N', () => {
    const o = szenario('krebs', 'Folie 20')
    expect(o.summe.value).toBeCloseTo(100_000, 6)
    const st = o.stationaer.value as number[]
    expect(st.reduce((a, b) => a + b, 0)).toBeCloseTo(100_000, 6)
    expect(st[1] / st[0]).toBeCloseTo(0.003 / 0.6, 12)
  })

  it('SIR (II 47–55): scenario A disease-free and stable, B endemic and stable', () => {
    const a = szenario('sir-stabilitaet', 'Szenario A')
    expect(a.R.value).toBeCloseTo(0.6, 12)
    expect(a.a.value).toMatch(/^stabil/)
    const b = szenario('sir-stabilitaet', 'Szenario B')
    expect(b.R.value).toBeCloseTo(3.8, 12)
    expect(b.a.value).toMatch(/^instabil/)
    expect(b.b.value).toMatch(/^stabil/)
  })

  it('cardiac map (II 63–64): period 38 for b = 0,26, irregular for b = 0,18, rest for b = 0,6', () => {
    expect(szenario('aktionspotential', 'spontan, b = 0,26').periode.value).toBe(38)
    expect(szenario('aktionspotential', 'EADs, b = 0,18').art.value).toBe('unregelmäßig: EADs')
    expect(szenario('aktionspotential', 'aus der Ruhe').art.value).toBe('Ruhe')
  })

  it('ring of cells (II 68–72): the timing of the second stimulus decides on re-entry', () => {
    expect(szenario('zellring', 'eine Welle').erregung.value).toBe('erlischt')
    expect(szenario('zellring', 'Szenario I').erregung.value).toBe('erlischt')
    expect(szenario('zellring', 'Szenario II').erregung.value).toBe('erlischt')
    expect(szenario('zellring', 'Szenario III').erregung.value).toBe('kreist weiter (Reentry)')
  })

  it('bioreactor (IV 27–28): the culture holds at (8,15, 0,92); a strong flow washes it out', () => {
    const o = szenario('bioreaktor', 'Folie 27')
    const [b, n] = o.gleichgewicht.value as number[]
    expect(n).toBeCloseTo((0.1 * 12) / 1.3, 9)
    expect(b).toBeCloseTo((5 - n) / 0.5, 9)
    expect(szenario('bioreaktor', 'Auswaschen').kultur.value).toBe('wird ausgewaschen')
  })

  it('pendulum (IV 5–7): stable spiral below, saddle above; small swings take 2π√(l/g)', () => {
    const o = szenario('pendel', 'kleine Auslenkung')
    expect(o.unten.value).toBe('stabiler Strudel')
    expect(o.oben.value).toBe('Sattel')
    expect(o.periode.value as number).toBeCloseTo(2 * Math.PI * Math.sqrt(1 / 9.81), 1)
    expect(szenario('pendel', 'ohne Dämpfung').unten.value).toBe('Zentrum')
  })

  it('cardiac cell (IV 30, 32): pacemaker with period ≈ 0,56 s, muscle cell in step with the stimulus', () => {
    const s = szenario('herzzelle', 'Schrittmacherzelle')
    expect(s.art.value).toBe('feuert von selbst')
    expect(s.periode.value as number).toBeCloseTo(0.564, 2)
    const m = szenario('herzzelle', 'Muskelzelle')
    expect(m.art.value).toBe('folgt den Reizen')
    expect(m.periode.value as number).toBeCloseTo(0.7, 2)
    expect(szenario('herzzelle', 'Muskelzelle ohne Reiz').art.value).toBe('ruht')
  })
})
