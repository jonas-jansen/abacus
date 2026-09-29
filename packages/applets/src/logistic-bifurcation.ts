// MATLAB: app_logistic_a — y_{n+1} = a y_n (1 − y_n) for a from 0 to 4, with the bifurcation
// diagram: where the sequence ends up, for every a at once. The current a is a line through it.

import { behaviour, detectPeriod, index, iteration, klasse, real, schritte } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

const MAX_PERIOD = 32
const A_MIN = 2.4

/**
 * The diagram does not depend on the sliders: computed once, on first use. For each a, the
 * values visited after a long transient (from y₀ = 0,5; for a ≤ 4 the attractor is the same
 * for almost every start).
 */
let diagram: { x: Float64Array; y: Float64Array } | null = null
function bifurcation() {
  if (diagram) return diagram
  const count = 1600
  const transient = 600
  const keep = 120
  const x = new Float64Array(count * keep)
  const y = new Float64Array(count * keep)
  for (let i = 0; i < count; i++) {
    const a = (4 * i) / (count - 1)
    let v = 0.5
    for (let k = 0; k < transient; k++) v = a * v * (1 - v)
    for (let k = 0; k < keep; k++) {
      v = a * v * (1 - v)
      x[i * keep + k] = a
      y[i * keep + k] = v
    }
  }
  diagram = { x, y }
  return diagram
}

const model = iteration({
  id: 'logistic-bifurcation',
  params: {
    a: real('Wachstumsrate', { latex: 'a', min: 0, max: 4, step: 0.001, default: 3.2 }),
    y0: real('Startwert', { latex: 'y_0', min: 0, max: 1, step: 0.01, default: 0.05 }),
    N: schritte('Schritte', { latex: 'N', default: 30, max: 200 }),
  },
  start: (p) => p.y0,
  step: (y, p) => p.a * y * (1 - y),
  horizon: (p) => p.N,
  series: { id: 'y', label: 'y_n' },
  extraSeries: ({ p }) => {
    const d = bifurcation()
    return [
      { id: 'diagramm', label: 'y^*', name: 'Langzeitwerte', kind: 'discrete', x: d.x, y: d.y, role: 'primary', connect: false },
      { id: 'jetzt', label: 'a', name: 'gewählt', kind: 'continuous', x: Float64Array.of(p.a, p.a), y: Float64Array.of(0, 1), role: 'secondary' },
    ]
  },
  observables: ({ p, x, tail }) => {
    const cycle = tail(4000, 128)
    const periode = detectPeriod(cycle, { maxPeriod: MAX_PERIOD })
    const v = behaviour(x)
    const values = periode === null ? [] : [...cycle.slice(-periode)]
    return {
      periode: index('Periode', periode, {
        note: periode === null ? `keine Periode ≤ ${MAX_PERIOD} – Chaos?` : undefined,
        marks: values.flatMap((c) => [
          { kind: 'value', v: c } as const,
          { kind: 'point', x: p.a, y: c, in: 'phase' } as const,
        ]),
      }),
      verhalten: klasse('Verhalten', v, v === null ? { note: 'kein einfaches Muster' } : {}),
    }
  },
})

export default defineApplet({
  id: 'logistic-bifurcation',
  titel: 'Verzweigungsdiagramm der logistischen Abbildung',
  kurz: 'Von der Ruhe über Zyklen der Länge 2, 4, 8 … ins Chaos.',
  kapitel: 'I',
  folien: '37–40',
  model,
  horizont: 'N',
  formeln: [
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
  anzeige: ['periode', 'verhalten'],
})
