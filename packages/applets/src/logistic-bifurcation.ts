// MATLAB: app_logistic_a — y_{n+1} = a y_n (1 − y_n) for a from 0 to 4, with the bifurcation
// diagram: where the sequence ends up, for every a at once. The current a is a line through it.

import { detectPeriod, index, iteration, real, steps, behaviour } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

const MAX_PERIOD = 32
const A_MIN = 2.4

/**
 * The diagram does not depend on the sliders. For each a, the values visited after a long
 * transient (from y₀ = 0.5; for a ≤ 4 the attractor is the same for almost every start).
 *
 * Zoomed in, it is recomputed for the visible window: for each a it iterates until enough
 * values have landed in the visible y range (or a budget is used up), so the picture stays
 * about equally dense at any magnification — a thin slice of the chaotic band included.
 */
const cache = new Map<string, { x: Float64Array; y: Float64Array }>()
function bifurcation(lo = 0, hi = 4, ylo = -Infinity, yhi = Infinity) {
  const COUNT = 900 // values of a across the window
  const TRANSIENT = 600
  const HITS = 140 // points per a we aim for in the window
  const BUDGET = 12_000 // iterations per a at most (a few dozen ms in all, only after zooming)
  const key = `${lo}|${hi}|${ylo}|${yhi}`
  const hit = cache.get(key)
  if (hit) return hit
  const [a0, a1] = [Math.max(0, lo), Math.min(4, hi)]
  const xs: number[] = []
  const ys: number[] = []
  for (let i = 0; i < COUNT; i++) {
    const a = a0 + ((a1 - a0) * i) / (COUNT - 1)
    let v = 0.5
    for (let k = 0; k < TRANSIENT; k++) v = a * v * (1 - v)
    let found = 0
    for (let k = 0; k < BUDGET && found < HITS; k++) {
      v = a * v * (1 - v)
      if (v >= ylo && v <= yhi) {
        xs.push(a)
        ys.push(v)
        found++
      }
    }
  }
  if (cache.size > 6) cache.delete(cache.keys().next().value!)
  const d = { x: Float64Array.from(xs), y: Float64Array.from(ys) }
  cache.set(key, d)
  return d
}

const model = iteration({
  id: 'logistic-bifurcation',
  params: {
    a: real('Wachstumsrate', { latex: 'a', min: 0, max: 4, step: 0.001, default: 3.2 }),
    y0: real('Startwert', { latex: 'y_0', min: 0, max: 1, step: 0.01, default: 0.05 }),
    N: steps('Schritte', { latex: 'N', default: 30, max: 200 }),
  },
  start: (p) => p.y0,
  step: (y, p) => p.a * y * (1 - y),
  horizon: (p) => p.N,
  series: { id: 'y', label: 'y_n' },
  extraSeries: ({ p, detail }) => {
    const d = detail?.x ? bifurcation(detail.x[0], detail.x[1], detail.y?.[0], detail.y?.[1]) : bifurcation()
    return [
      { id: 'diagramm', label: 'y^*', name: 'Langzeitwerte', kind: 'discrete', x: d.x, y: d.y, role: 'primary', connect: false },
      { id: 'jetzt', label: 'a', name: 'gewählt', kind: 'continuous', x: Float64Array.of(p.a, p.a), y: Float64Array.of(0, 1), role: 'secondary' },
    ]
  },
  observables: ({ p, x, tail }) => {
    const cycle = tail(4000, 128)
    const periode = detectPeriod(cycle, { maxPeriod: MAX_PERIOD })
    const values = periode === null ? [] : [...cycle.slice(-periode)]
    return {
      periode: index('Periode', periode, {
        note: periode === null ? `keine Periode ≤ ${MAX_PERIOD} – Chaos?` : undefined,
        marks: values.flatMap((c) => [
          { kind: 'value', v: c } as const,
          { kind: 'point', x: p.a, y: c, in: 'phase' } as const,
        ]),
      }),
      verhalten: behaviour('Verhalten', x),
    }
  },
})

export default defineApplet({
  id: 'logistic-bifurcation',
  model,
  horizon: 'N',
  formulas: [
    { label: 'Vorschrift', tex: String.raw`y_{n+1} = {{a}}{{*}}y_n\,(1 - y_n)` },
    { label: 'Start', tex: String.raw`y_0 = {{#y0}}` },
  ],
  plots: [
    {
      type: 'scatter',
      series: ['diagramm', 'jetzt'],
      xLabel: 'a',
      yLabel: 'y^*',
      x: (p) => (p.a < A_MIN ? [0, 4] : [A_MIN, 4]),
      y: [0, 1],
      // slide the line through the diagram
      drag: [{ param: 'a', axis: 'x', at: (p) => [p.a, 0.96], set: (x) => ({ a: x }) }],
    },
    { type: 'timeSeriesDiscrete', series: ['y'], xLabel: 'n', yLabel: 'y_n', y: [0, 1], drag: { param: 'y0', axis: 'y' } },
  ],
  readouts: ['periode', 'verhalten'],
})
