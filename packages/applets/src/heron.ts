// MATLAB: app_recursive_sqrt2 — Heron's method x_{n+1} = ½(x_n + 2/x_n), i.e. Newton's method
// for x² = 2. Converges to ±√2 by the sign of x₀; the number of correct digits roughly
// doubles per step.

import { iteration, list, real, sample, steps, quantity } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

const heron = (x: number) => 0.5 * (x + 2 / x)
/** Correct decimal digits of x as an approximation of L, capped at double precision. */
const digits = (x: number, L: number) => {
  const e = Math.abs(x - L)
  return !Number.isFinite(e) ? 0 : e === 0 ? 16 : Math.max(0, Math.min(16, Math.floor(-Math.log10(e / Math.abs(L)))))
}

const model = iteration({
  id: 'heron',
  params: {
    x0: real('Startwert', { latex: 'x_0', min: -3, max: 5, step: 0.05, default: 0.5 }),
    N: steps('Schritte', { latex: 'N', default: 8, max: 12 }),
  },
  start: (p) => p.x0,
  step: (x) => heron(x),
  horizon: (p) => p.N,
  extraSeries: ({ p, n, x, detail }) => {
    const L = p.x0 < 0 ? -Math.SQRT2 : Math.SQRT2
    // f with its pole at 0 cut out, so the graph is not joined across it
    const [lo, hi] = detail?.x ?? [-5, 5]
    // the pole at 0 is cut out (at least 1 % of the visible width), so the graph is not joined across it
    const gap = Math.min(0.12, (hi - lo) * 0.01)
    const f = sample((t) => (Math.abs(t) < gap ? NaN : heron(t)), lo, hi, 801)
    return [
      { id: 'f', label: 'f(x) = \\tfrac12 (x + 2/x)', kind: 'continuous', x: f.x, y: f.y, role: 'primary' },
      // the error; exactly 0 would have no place on a log axis, so it stops at machine precision
      { id: 'fehler', label: '|x_n - x^*|', kind: 'discrete', x: n, y: x.map((v) => Math.max(Math.abs(v - L), Number.EPSILON * Math.SQRT2)), role: 'tertiary' },
    ]
  },
  observables: ({ p, x }) => {
    if (p.x0 === 0) {
      const none = { note: 'bei x₀ = 0 ist 2/x₀ nicht definiert' }
      return { grenzwert: quantity('Grenzwert', null, none), stellen: list('richtige Stellen', null, none), fehler: quantity('Fehler', null, none) }
    }
    const L = p.x0 < 0 ? -Math.SQRT2 : Math.SQRT2
    const d = [...x].map((v) => digits(v, L))
    return {
      grenzwert: quantity('Grenzwert', L, { digits: 10, marks: [{ kind: 'value', v: L }] }),
      stellen: list('richtige Stellen je Schritt', d, {
        marks: [...x].map((v, item) => ({ kind: 'point', x: item, y: Math.max(Math.abs(v - L), Number.EPSILON * Math.SQRT2), in: 'time', item })),
      }),
      fehler: quantity('Fehler $|x_N - x^*|$', Math.abs(x[x.length - 1] - L), { digits: 3 }),
    }
  },
})

export default defineApplet({
  id: 'heron',
  model,
  horizon: 'N',
  formulas: [
    { label: 'Vorschrift', tex: String.raw`x_{n+1} = \frac12\left(x_n + \frac{2}{x_n}\right)` },
    { label: 'Start', tex: String.raw`x_0 = {{#x0}}` },
  ],
  plots: [
    { type: 'cobweb', f: 'f', orbit: 'x', xLabel: 'x', yLabel: 'f(x)', x: [-5, 5], y: [-5, 5], drag: { param: 'x0', axis: 'x' } },
    {
      type: 'timeSeriesDiscrete',
      series: ['fehler'],
      title: 'Fehler',
      xLabel: 'n',
      yLabel: '|x_n - x^*|',
      yScale: 'log',
      yLogRange: [1e-17, 10],
      logToggle: true,
      logHilfe:
        'Hier heißt jede Zehnerpotenz weiter unten: eine richtige Nachkommastelle mehr. Die Punkte fallen immer steiler – die Zahl der richtigen Stellen verdoppelt sich ungefähr in jedem Schritt. Bei $10^{-16}$ ist die Rechengenauigkeit des Computers erreicht.',
    },
  ],
  readouts: ['grenzwert', 'stellen', 'fehler'],
})
