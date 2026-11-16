import { defaultParams } from '@abacus/applet-core'
import { describe, expect, it } from 'vitest'
import { applets, exerciseApplets } from '../index'

const run = (id: string, scenario: string) => {
  const def = exerciseApplets[id]
  const s = def.scenarios!.find((x) => x.label === scenario)!
  return def.model.run({ ...defaultParams(def.model), ...s.params } as never)
}
const values = (id: string, scenario: string, series = 'x') => Array.from(run(id, scenario).series.find((s) => s.id === series)!.y)

describe('Übungsblatt 1', () => {
  it('has its own ids, none of them in the gallery', () => {
    for (const id of Object.keys(exerciseApplets)) expect(applets[id]).toBeUndefined()
  })

  it('1.1: the first five terms', () => {
    expect(values('blatt1-sonnenblume', 'n = 0 … 4')).toEqual([5, 8, 11, 14, 17])
    expect(values('blatt1-wirkstoff', 'n = 0 … 4').map((v) => +v.toFixed(4))).toEqual([100, 80, 64, 51.2, 40.96])
    expect(values('blatt1-insekten', 'n = 0 … 4')).toEqual([800, 200, 800, 200, 800])
  })

  it('1.2: Beverton–Holt from 1/2, 1 and 2', () => {
    expect(values('blatt1-fische', 'a) x₀ = 1/2', 'half').map((v) => +v.toFixed(6))).toEqual([0.5, +(2 / 3).toFixed(6), 0.8, +(8 / 9).toFixed(6)])
    expect(values('blatt1-fische', 'b) x₀ = 1', 'one')).toEqual([1, 1, 1, 1])
    expect(values('blatt1-fische', 'c) x₀ = 2', 'two').map((v) => +v.toFixed(6))).toEqual([2, +(4 / 3).toFixed(6), +(8 / 7).toFixed(6), +(16 / 15).toFixed(6)])
    expect(run('blatt1-fische', 'd) alle drei').series.filter((s) => ['half', 'one', 'two'].includes(s.id))).toHaveLength(3)
  })

  it('1.4 and 1.5: E. coli after 2 hours, the catfish after 6 months', () => {
    expect(values('blatt1-ecoli', '2 Stunden').at(-1)).toBe(128)
    expect(values('blatt1-ecoli', '6 Stunden').at(-1)).toBe(2 * 2 ** 18)
    const q = 1.08 ** 6
    expect(values('blatt1-welse', '6 Monate').at(-1)).toBeCloseTo(5000 * q - (300 * (q - 1)) / 0.08, 6)
    // a catch of 400 holds the pond at 5000 (8 % of 5000)
    expect(values('blatt1-welse', '400 im Monat').at(-1)).toBeCloseTo(5000, 6)
  })
})

describe('Übungsblatt 2', () => {
  it('2.1: c₀ … c₄ = 1, 1, 4/3, 2, 16/5, and the formula 2ⁿ/(n + 1) fits', () => {
    const c = values('blatt2-zellkultur', 'c₀ … c₄')
    expect(c.map((v) => +v.toFixed(9))).toEqual([1, 1, +(4 / 3).toFixed(9), 2, 3.2])
    for (const [n, v] of c.entries()) expect(v).toBeCloseTo(2 ** n / (n + 1), 12)
  })

  it('2.2: x₀ … x₅ = 10, 20, 70, 200, 610, 1820', () => {
    expect(values('blatt2-mohn', 'x₀ … x₅')).toEqual([10, 20, 70, 200, 610, 1820])
  })
})

describe('Übungsblatt 4', () => {
  const obs = (id: string, scenario: string, key: string) => {
    const def = exerciseApplets[id]
    const s = def.scenarios!.find((x) => x.label === scenario)!
    const p = { ...defaultParams(def.model), ...s.params } as never
    return def.model.run(p).observables![key].value
  }

  it('4.1: x₀ = 1900 dies out at once (x₁ = −152), the limit is K(1 + 1/r) ≈ 1833.3', () => {
    expect(values('blatt4-ausloeschung', 'x₀ = 1900')[1]).toBeCloseTo(-152, 9)
    expect(values('blatt4-ausloeschung', 'x₀ = 500')[1]).toBeCloseTo(800, 9)
    expect(obs('blatt4-ausloeschung', 'Grenze', 'grenze')).toBeCloseTo(1000 * (1 + 1 / 1.2), 9)
    expect(obs('blatt4-gleichgewicht', 'Gleichgewichte', 'fix')).toEqual([0, 1000])
  })

  it('4.2: W at 0, 1000, 2000, 3000 and x₁, x₂, x₃ = 602.4, 970.7, 1005.4 from 2000', () => {
    const w = obs('blatt4-ricker-faktor', 'W(0), W(1000), W(2000), W(3000)', 'werte') as number[]
    expect(w.map((v) => +v.toFixed(4))).toEqual([3.3201, 1, 0.3012, 0.0907])
    expect(values('blatt4-ricker-folge', 'x₁, x₂, x₃').map((v) => +v.toFixed(1))).toEqual([2000, 602.4, 970.7, 1005.4])
  })

  it('4.3: the sequence from 1/2 is 2ⁿ/(1 + 2ⁿ), f(X) → 2, the quotient at 0 → 2', () => {
    for (const [n, v] of values('blatt4-bh', 'a) Grenzwert').entries()) expect(v).toBeCloseTo(2 ** n / (1 + 2 ** n), 12)
    expect(obs('blatt4-bh-unendlich', 'x bis 100 000', 'fX')).toBeCloseTo(2, 4)
    expect(obs('blatt4-bh-ableitung', 'h = 0.01', 'quotient')).toBeCloseTo(2 / 1.01, 9)
    expect(obs('blatt4-bh-ableitung', 'h = 0.01', 'rechts')).toBeCloseTo(2, 5)
  })

  it('4.4: (1 − x)/(2 + x) has f′(1) = −1/3, |x| at 0 has −1 and 1', () => {
    expect(obs('blatt4-differenzierbar', 'a) h = 0.5', 'links')).toBeCloseTo(-1 / 3, 5)
    expect(obs('blatt4-differenzierbar', 'a) h = 0.5', 'rechts')).toBeCloseTo(-1 / 3, 5)
    expect(obs('blatt4-differenzierbar', 'b) h > 0', 'links')).toBe(-1)
    expect(obs('blatt4-differenzierbar', 'b) h > 0', 'rechts')).toBe(1)
    expect(obs('blatt4-differenzierbar', 'b) h > 0', 'ergebnis')).toMatch(/^nein/)
    expect(obs('blatt4-differenzierbar', 'b) a = 1', 'ergebnis')).toBe("ja, f'(a) = 1")
  })
})
