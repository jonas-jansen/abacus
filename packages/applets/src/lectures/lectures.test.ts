import { defaultParams } from '@abacus/applet-core'
import { describe, expect, it } from 'vitest'
import { applets, exerciseApplets } from '../index'

const run = (id: string, scenario: string) => {
  const def = exerciseApplets[id]
  const s = def.scenarios!.find((x) => x.label === scenario)!
  return def.model.run({ ...defaultParams(def.model), ...s.params } as never)
}
const values = (id: string, scenario: string, series: string) => Array.from(run(id, scenario).series.find((s) => s.id === series)!.y)

describe('Vorlesung Kapitel 1b: the slides’ numbers', () => {
  it('has its own ids, none of them in the gallery', () => {
    for (const id of Object.keys(exerciseApplets)) expect(applets[id]).toBeUndefined()
  })

  it('Folie 3: Heron from 0.5, one step to 2.25', () => {
    expect(values('v1b-heron', 'Folie 3: der erste Schritt', 'x')).toEqual([0.5, 2.25])
  })

  it('Folien 14 and 16: the two progressions', () => {
    expect(values('v1b-arithmetisch', 'Folie 14', 's1').at(-1)).toBe(40)
    expect(values('v1b-arithmetisch', 'Folie 14', 's2').at(-1)).toBe(10)
    expect(values('v1b-geometrisch', 'Folie 16', 's1').at(-1)).toBeCloseTo(10 * 1.1 ** 25, 6)
  })

  it('Folie 18: 1.1ⁿ overtakes 1000 + 1000 n at n = 124', () => {
    expect(run('v1b-wettlauf', 'Folie 18').observables.ueberholt.value).toBe(124)
  })

  it('Folien 19–20: 0, 50, 90, 122, 147.6 … towards 250', () => {
    expect(values('v1b-linear', 'Folien 19–20', 'x').slice(0, 5).map((v) => +v.toFixed(6))).toEqual([0, 50, 90, 122, 147.6])
    expect(run('v1b-linear', 'Folien 19–20').observables.gleichgewicht.value).toBeCloseTo(250, 9)
  })

  it('Folien 22–23: the soup is under 10 °C after 12 steps of 10 minutes; α = 2 jumps between 80 and −72', () => {
    expect(run('v1b-abkuehlung', 'Folie 22').observables.unter.value).toBe(120)
    expect(values('v1b-abkuehlung', 'α = 2', 'T').slice(0, 3)).toEqual([80, -72, 80])
  })

  it('Folie 27: f(K) = K, the top at x = 7.5', () => {
    const def = exerciseApplets['v1b-logistisch-f']
    const f = def.model.run({ ...defaultParams(def.model), r: 0.5, K: 5 } as never).series.find((s) => s.id === 'f')!
    const top = f.y.reduce((m, v) => Math.max(m, v), -Infinity)
    expect(top).toBeCloseTo(5.625, 2)
  })

  it('Folie 33: from 0.2 and 0.2001 the sequences part', () => {
    const o = run('v1b-chaos', 'Folie 33').observables
    expect(o.art.value).toBe('laufen auseinander')
    expect(run('v1b-chaos', 'a = 2.8').observables.art.value).toBe('bleiben beieinander')
  })
})

describe('Vorlesung Anhang A: the slides’ numbers', () => {
  it('Folien 3–5: N = 4 for the slides’ ε, N = 1/ε for 1/n', () => {
    expect(run('va-grenzwert', 'Folien 3–4').observables.N.value).toBe(4)
    expect(run('va-eins-durch-n', 'Folie 5').observables.N.value).toBe(4)
    expect(run('va-eins-durch-n', 'ε = 0.1').observables.N.value).toBe(10)
    expect(run('va-eins-durch-n', 'ε = 0.01').observables.N.value).toBe(100)
  })

  it('Folien 6–7: (−1)ⁿ, Heron, the drug and malaria', () => {
    expect(values('va-folgen-6', 'Folie 6: (−1)ⁿ', 'x').slice(0, 4)).toEqual([1, -1, 1, -1])
    expect(values('va-folgen-6', 'Folie 6: Heron', 'x').at(-1)).toBeCloseTo(Math.SQRT2, 12)
    expect(values('va-folgen-7', 'Folie 7: Medikament', 'x').at(-1)).toBeCloseTo(250 - 250 * 0.8 ** 20, 9)
    expect(values('va-folgen-7', 'Folie 7: Malaria', 'x').at(-1)).toBe(8 ** 10)
  })

  it('Folie 16: x_n = 1/n, f(x_n) = 1 but f(0) = −1', () => {
    expect(values('va-unstetig', 'Folie 16', 'folge').slice(1, 4)).toEqual([1, 0.5, 1 / 3])
    const o = run('va-unstetig', 'Folie 16').observables
    expect([o.fa.value, o.fxN.value]).toEqual([-1, 1])
  })

  it('Folie 19: (x² − 1)/(x − 1) is not defined at 1, f(x_n) → 2', () => {
    const o = run('va-grenzwert-a', 'Folie 19').observables
    expect(o.fa.value).toBeNull()
    expect(o.fxN.value).toBeCloseTo(2 + 1 / 12, 9)
  })

  it('Folien 22–25: secant slope 10 for h = 1, f′(1) = 5, t(x) = 5x − 3', () => {
    expect(run('va-sekante', 'Folie 22').observables.quotient.value).toBe(10)
    expect(run('va-tangente', 'Folie 25').observables.ableitung.value).toBe(5)
    const t = run('va-tangente', 'Folie 25').series.find((s) => s.id === 'tangente')!
    expect(t.y[0]).toBeCloseTo(5 * t.x[0] - 3, 12)
  })

  it('Folie 23: g(h) is 2 at h = −1 and 10 at h = 1, with a hole at 0', () => {
    const g = run('va-quotient', 'Folie 23').series.find((s) => s.id === 'g')!
    expect(g.y[0]).toBeCloseTo(2, 12)
    expect(g.y.at(-1)).toBeCloseTo(10, 12)
    expect(g.y[200]).toBeNaN()
  })
})

describe('Vorlesung Kapitel 1, stationäre Zustände und Stabilität: the slides’ numbers', () => {
  it('Folien 36–40: the stationary states', () => {
    expect(run('vs-fixpunkte-36', 'Folie 36').observables.fix.value).toEqual([0, 1 - 1 / 2.8])
    expect(run('vs-fixpunkte-37', 'Folie 37').observables.fix.value).toEqual([expect.closeTo(250, 9)])
    expect(run('vs-fixpunkte-38', 'Folie 38').observables.fix.value).toBe('keine')
    expect(run('vs-fixpunkte-39', 'Folie 39').observables.fix.value).toEqual([0, 1])
    expect((run('vs-fixpunkte-40', 'a = 3.2').observables.fix.value as number[])[1]).toBeCloseTo(0.6875, 12)
  })

  it('Folien 44–48: the staircases run into x* = 100 or away from it', () => {
    expect(values('vs-spinnweb-44', 'x₃', 'x')).toEqual([10, 55, 77.5, 88.75])
    expect(values('vs-spinnweb-45', 'Folie 45', 'x2').at(-1)).toBeCloseTo(100, 2)
    expect(values('vs-spinnweb-46', 'Folie 46', 'x').at(-1)).toBeCloseTo(100 - 10 * 1.5 ** 8, 9)
    expect(values('vs-spinnweb-47', 'a = −1.2', 'x').at(-1)).toBeCloseTo(100 + 10 * 1.2 ** 12, 6)
  })

  it('Folie 68: from 0.5 the epidemic reaches 0.7968 after 40 steps, f′(x*) ≈ 0.41', () => {
    const o = run('vs-spinnweb-68', 'Folie 68').observables
    expect(o.xN.value).toBeCloseTo(0.7968, 4)
    expect((o.steigung.value as number[])[1]).toBeCloseTo(0.41, 2)
  })

  it('Folien 56–59: f′(x*) = ½, 1.8, −0.6 and −1.2', () => {
    expect(run('vs-lupe-56', 'Folie 56').observables.steigung.value).toBeCloseTo(0.5, 12)
    expect(run('vs-lupe-57', 'Folie 57').observables.steigung.value).toBeCloseTo(1.8, 12)
    expect(run('vs-lupe-58', 'Folie 58').observables.steigung.value).toBeCloseTo(-0.6, 12)
    expect(run('vs-lupe-59', 'Folie 59').observables.art.value).toBe('instabil')
  })

  it('Folie 71: Newton from 1 gives 0.8144387, 0.7970151, 0.7968121582', () => {
    const x = values('vs-newton', 'Folie 71', 'x')
    expect(x[1]).toBeCloseTo(0.8144387, 7)
    expect(x[2]).toBeCloseTo(0.7970151, 7)
    expect(x[3]).toBeCloseTo(0.7968121582, 10)
  })

  it('Folie 73: the best step for √x at 1 is about h = 10⁻⁸', () => {
    expect(run('vs-numerisch', 'Folie 73').observables.bester.value).toBeGreaterThanOrEqual(7)
    expect(run('vs-numerisch', 'Folie 73').observables.bester.value).toBeLessThanOrEqual(9)
  })
})
