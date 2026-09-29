// MATLAB: app_logistic_rK — x_{n+1} = x_n + r (1 − x_n/K) x_n. K is always a fixed point with
// f′(K) = 1 − r, so monotone approach ends at r = 1 and convergence at r = 2 — for every K.

import { behaviour, detectPeriod, fixedPoints, index, iteration, klasse, liste, real, sample, schritte } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

const MAX_PERIOD = 16

const model = iteration({
  id: 'logistic-rk',
  params: {
    r: real('Wachstumsrate', { latex: 'r', min: 0, max: 3, step: 0.01, default: 1 }),
    K: real('Kapazität', { latex: 'K', min: 0.5, max: 8, step: 0.1, default: 5, limits: { min: 1e-6, reason: 'K steht im Nenner und muss positiv sein.' } }),
    x0: real('Startwert', { latex: 'x_0', min: 0, max: 8, step: 0.05, default: 0.1 }),
    N: schritte('Schritte', { latex: 'N', default: 50, max: 150 }),
  },
  start: (p) => p.x0,
  step: (x, p) => x + p.r * (1 - x / p.K) * x,
  horizon: (p) => p.N,
  extraSeries: ({ p, map, detail }) => {
    const [lo, hi] = detail?.x ?? [0, 1.5 * p.K]
    const { x, y } = sample(map, lo, hi, 401)
    return [{ id: 'f', label: 'f(x) = x + r\\,(1 - x/K)\\,x', kind: 'continuous', x, y, role: 'primary' }]
  },
  observables: ({ p, x, map, tail }) => {
    const fps = fixedPoints(map, -0.01 * p.K, 1.5 * p.K)
    const periode = detectPeriod(tail(2000, 64), { maxPeriod: MAX_PERIOD })
    const cycle = tail(2000, 64)
    const v = behaviour(x)
    return {
      fixpunkte: liste(
        'Fixpunkte $x^*$',
        fps.map((f) => f.x),
        { marks: fps.map((f, item) => ({ kind: 'value', v: f.x, item })) },
      ),
      steigungen: liste(
        "Steigung $f'(x^*)$",
        fps.map((f) => f.slope),
        { digits: 3, marks: fps.map((f, item) => ({ kind: 'line', x: f.x, y: f.x, slope: f.slope, in: 'map', item })) },
      ),
      periode: index('Periode', periode, {
        note: periode === null ? `keine Periode ≤ ${MAX_PERIOD} gefunden` : undefined,
        marks: periode === null ? [] : [...cycle.slice(-periode)].map((c) => ({ kind: 'value', v: c })),
      }),
      verhalten: klasse('Verhalten', v, v === null ? { note: 'kein einfaches Muster' } : {}),
    }
  },
})

export default defineApplet({
  id: 'logistic-rk',
  titel: 'Diskretes logistisches Wachstum',
  kurz: 'Wachstumsrate r und Kapazität K – welcher Parameter entscheidet über Ruhe oder Chaos?',
  kapitel: 'I',
  folien: '32–36',
  model,
  horizont: 'N',
  formeln: [
    { label: 'Vorschrift', tex: String.raw`x_{n+1} = x_n {{+r}}\left(1 - \frac{x_n}{{{K}}}\right) x_n` },
    { label: 'Start', tex: String.raw`x_0 = {{#x0}}` },
    { label: 'Steigung', tex: String.raw`f'({{K}}) = 1 - {{r}}` },
  ],
  plots: [
    { type: 'timeSeriesDiscrete', series: ['x'], xLabel: 'n', yLabel: 'x_n', y: (p) => [0, 1.5 * p.K], drag: { param: 'x0', axis: 'y' } },
    {
      type: 'cobweb',
      f: 'f',
      orbit: 'x',
      xLabel: 'x',
      yLabel: 'f(x)',
      x: (p) => [0, 1.5 * p.K],
      y: (p) => [0, 1.5 * p.K],
      drag: [
        { param: 'x0', axis: 'x' },
        // f(K) = K: move the fixed point along the diagonal
        { param: 'K', axis: 'x', at: (p) => [p.K, p.K], set: (x) => ({ K: x }) },
        // f(K/2) = K/2 + r·K/4
        { param: 'r', axis: 'y', at: (p) => [p.K / 2, p.K / 2 + (p.r * p.K) / 4], set: (_x, y, p) => ({ r: (4 * (y - p.K / 2)) / p.K }) },
      ],
    },
  ],
  layout: { main: ['r', 'K', 'x0'] },
  anzeige: ['fixpunkte', 'steigungen', 'periode', 'verhalten'],
})
