// MATLAB: app_updatefunction_logistica (+ app_logistic_a) — y_{n+1} = a·y_n·(1 − y_n) as a cobweb.
// Build order #3: the first new plot type, draggable x₀, StepControl.

import {
  behaviour,
  detectPeriod,
  fixedPoints,
  index,
  schritte,
  iteration,
  klasse,
  liste,
  real,
  sample,
} from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

const MAX_PERIOD = 16

const model = iteration({
  id: 'logistic-cobweb',
  params: {
    a: real('Wachstumsrate', { latex: 'a', min: 0, max: 4, step: 0.01, default: 2.8 }),
    y0: real('Startwert', { latex: 'y_0', min: 0, max: 1, step: 0.01, default: 0.1 }),
    N: schritte('Schritte', { latex: 'N', default: 40, max: 200 }),
  },
  start: (p) => p.y0,
  step: (y, p) => p.a * y * (1 - y),
  horizon: (p) => p.N,
  series: { id: 'y', label: 'y_n' },
  extraSeries: ({ map }) => {
    const { x, y } = sample(map, 0, 1, 201)
    return [{ id: 'f', label: 'f(y) = a\\,y\\,(1-y)', kind: 'continuous', x, y, role: 'primary' }]
  },
  observables: ({ x, map, tail }) => {
    const fps = fixedPoints(map, 0, 1)
    const cycle = tail(2000, 64)
    const periode = detectPeriod(cycle, { maxPeriod: MAX_PERIOD })
    const v = behaviour(x)
    return {
      fixpunkte: liste(
        'Fixpunkte $y^*$',
        fps.map((f) => f.x),
        { marks: fps.map((f, item) => ({ kind: 'value', v: f.x, item })) },
      ),
      steigungen: liste(
        'Steigung $f\'(y^*)$',
        fps.map((f) => f.slope),
        { digits: 3, marks: fps.map((f, item) => ({ kind: 'line', x: f.x, y: f.x, slope: f.slope, in: 'map', item })) },
      ),
      periode: index('Periode', periode, {
        note: periode === null ? `keine Periode ≤ ${MAX_PERIOD} gefunden` : undefined,
        // the values the orbit cycles through
        marks: periode === null ? [] : [...cycle.slice(-periode)].map((c) => ({ kind: 'value', v: c })),
      }),
      verhalten: klasse('Verhalten', v, v === null ? { note: 'kein einfaches Muster' } : {}),
    }
  },
})

export default defineApplet({
  id: 'logistic-cobweb',
  titel: 'Spinnwebdiagramm der logistischen Abbildung',
  kurz: 'Vom Graphen zur Diagonale und zurück: so entsteht die Folge.',
  model,
  formeln: [
    { label: 'Vorschrift', tex: String.raw`y_{n+1} = {{a}}{{*}}y_n\,(1 - y_n)` },
    { label: 'Start', tex: String.raw`y_0 = {{y0}}` },
    { label: 'Fixpunkte', tex: String.raw`y^* = 0, \quad y^* = 1 - \frac{1}{{{a}}}` },
  ],
  plots: [
    {
      type: 'cobweb',
      f: 'f',
      orbit: 'y',
      xLabel: 'y',
      yLabel: 'f(y)',
      x: [0, 1],
      y: [0, 1],
      drag: [
        { param: 'y0', axis: 'x' },
        // the top of the parabola is at height a/4
        { param: 'a', axis: 'y', at: (p) => [0.5, p.a / 4], set: (_x, y) => ({ a: 4 * y }) },
      ],
    },
    { type: 'timeSeriesDiscrete', series: ['y'], xLabel: 'n', yLabel: 'y_n', y: [0, 1], aspect: 1, drag: { param: 'y0', axis: 'y' } },
  ],
  anzeige: ['fixpunkte', 'steigungen', 'periode', 'verhalten'],
})
