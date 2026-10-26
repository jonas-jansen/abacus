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
