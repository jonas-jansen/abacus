// MATLAB: app_recursive_sqrt2 — Heron's method x_{n+1} = ½(x_n + 2/x_n), i.e. Newton's method
// for x² = 2. Converges to ±√2 by the sign of x₀; the number of correct digits roughly
// doubles per step.

import { iteration, liste, real, sample, schritte, zahl } from '@abacus/applet-core'
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
    N: schritte('Schritte', { latex: 'N', default: 8, max: 12 }),
  },
  start: (p) => p.x0,
  step: (x) => heron(x),
  horizon: (p) => p.N,
  extraSeries: ({ p, n, x }) => {
    const L = p.x0 < 0 ? -Math.SQRT2 : Math.SQRT2
    // f with its pole at 0 cut out, so the graph is not joined across it
    const f = sample((t) => (Math.abs(t) < 0.12 ? NaN : heron(t)), -5, 5, 801)
    return [
      { id: 'f', label: 'f(x) = \\tfrac12 (x + 2/x)', kind: 'continuous', x: f.x, y: f.y, role: 'primary' },
      { id: 'stellen', label: 'd_n', kind: 'discrete', x: n, y: x.map((v) => digits(v, L)), role: 'tertiary' },
    ]
  },
  observables: ({ p, x }) => {
    if (p.x0 === 0) {
      const none = { note: 'bei x₀ = 0 ist 2/x₀ nicht definiert' }
      return { grenzwert: zahl('Grenzwert', null, none), stellen: liste('richtige Stellen', null, none), fehler: zahl('Fehler', null, none) }
    }
    const L = p.x0 < 0 ? -Math.SQRT2 : Math.SQRT2
    const d = [...x].map((v) => digits(v, L))
    return {
      grenzwert: zahl('Grenzwert', L, { digits: 10, marks: [{ kind: 'value', v: L }] }),
      stellen: liste('richtige Stellen je Schritt', d, { marks: d.map((v, item) => ({ kind: 'point', x: item, y: v, in: 'time', item })) }),
      fehler: zahl('Fehler $|x_N - x^*|$', Math.abs(x[x.length - 1] - L), { digits: 3 }),
    }
  },
})

export default defineApplet({
  id: 'heron',
  titel: 'Heron-Verfahren für √2',
  kurz: 'Mittelwert aus x und 2/x – und die Zahl der richtigen Stellen verdoppelt sich.',
  model,
  plots: [
    { type: 'cobweb', f: 'f', orbit: 'x', xLabel: 'x', yLabel: 'f(x)', x: [-5, 5], y: [-5, 5], drag: { param: 'x0', axis: 'x' } },
    { type: 'timeSeriesDiscrete', series: ['stellen'], xLabel: 'n', yLabel: 'd_n', y: [0, 17], title: 'richtige Stellen' },
  ],
  anzeige: ['grenzwert', 'stellen', 'fehler'],
})
