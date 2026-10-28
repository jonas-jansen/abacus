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
