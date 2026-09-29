// MATLAB: app_logistic_a_perturbation — start exactly on the fixed point y* = 1 − 1/a and add
// small random kicks from n = 5 on. A stable fixed point absorbs them; an unstable one
// amplifies them. The kicks are seeded, so every student sees the same sequence.

import { bool, int, iteration, klasse, maximum, real, sample, schritte, zahl } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

const KICK_FROM = 5

const model = iteration({
  id: 'logistic-perturbation',
  params: {
    a: real('Wachstumsrate', { latex: 'a', min: 1.5, max: 4, step: 0.01, default: 2.5 }),
    stoerung: bool('Störung', { labelOn: 'an', labelOff: 'aus', default: true }),
    eps: real('Stärke der Störung', { latex: '\\varepsilon', min: 0, max: 0.05, step: 0.001, default: 0.005 }),
    seed: int('Zufallsfolge', { latex: 's', min: 1, max: 20, default: 5 }),
    N: schritte('Schritte', { latex: 'N', default: 100, max: 300 }),
  },
  start: (p) => 1 - 1 / p.a,
  step: (y, p, n, rng) => {
    const next = p.a * y * (1 - y)
    const kick = rng.normal() // drawn every step, so the sequence of kicks does not depend on the switch
    return p.stoerung && n + 1 >= KICK_FROM ? next + p.eps * kick : next
  },
  horizon: (p) => p.N,
  seed: (p) => p.seed,
  series: { id: 'y', label: 'y_n', name: 'mit Störung' },
  extraSeries: ({ p, n }) => {
    const y = 1 - 1 / p.a
    const f = sample((v) => p.a * v * (1 - v), 0, 1, 201)
    return [
      { id: 'fix', label: 'y^*', name: 'Fixpunkt', kind: 'continuous', x: Float64Array.of(0, n.length - 1), y: Float64Array.of(y, y), role: 'reference' },
      { id: 'f', label: 'f(y)', kind: 'continuous', x: f.x, y: f.y, role: 'primary' },
    ]
  },
  observables: ({ p, x }) => {
    const fix = 1 - 1 / p.a
    const slope = 2 - p.a
    const dev = maximum(x.subarray(Math.min(x.length, KICK_FROM)).map((v) => Math.abs(v - fix)))
    return {
      fixpunkt: zahl('Fixpunkt $y^* = 1 - 1/a$', fix, { marks: [{ kind: 'value', v: fix }] }),
      steigung: zahl("Steigung $f'(y^*) = 2 - a$", slope, { digits: 3, marks: [{ kind: 'line', x: fix, y: fix, slope, in: 'map' }] }),
      stabil: klasse('Fixpunkt ist', Math.abs(slope) < 1 ? 'stabil' : Math.abs(slope) > 1 ? 'instabil' : 'Grenzfall'),
      abweichung: zahl('größte Abweichung von $y^*$', dev?.value ?? null, {
        digits: 2,
        note: 'noch keine Störung',
        marks: dev ? [{ kind: 'point', x: dev.index + KICK_FROM, y: x[dev.index + KICK_FROM], in: 'time' }] : [],
      }),
    }
  },
})

export default defineApplet({
  id: 'logistic-perturbation',
  titel: 'Stabil oder instabil?',
  kurz: 'Die Folge startet genau im Fixpunkt – dann kommen kleine Stöße.',
  kapitel: 'I',
  folien: '41, 50–55',
  model,
  horizont: 'N',
  formeln: [
    { label: 'Vorschrift', tex: String.raw`y_{n+1} = {{a}}{{*}}y_n\,(1 - y_n) + {{eps}}{{*}}\xi_n` },
    { label: 'Start', tex: String.raw`y_0 = y^* = 1 - \frac{1}{{{a}}}` },
    { label: 'Störung', tex: String.raw`\xi_n \sim \mathcal{N}(0, 1) \text{ ab } n = 5, \quad {{stoerung}}, \ \text{Zufallsfolge } {{#seed}}` },
  ],
  plots: [
    {
      type: 'timeSeriesDiscrete',
      series: ['y', 'fix'],
      xLabel: 'n',
      yLabel: 'y_n',
      y: [0, 1],
      // y* = 1 − 1/a: raising the fixed point raises a
      drag: [{ param: 'a', axis: 'y', at: (p) => [p.N, 1 - 1 / p.a], set: (_x, y) => ({ a: 1 / (1 - Math.min(y, 0.99)) }) }],
    },
    {
      type: 'cobweb',
      f: 'f',
      orbit: 'y',
      xLabel: 'y',
      yLabel: 'f(y)',
      x: [0, 1],
      y: [0, 1],
      drag: [{ param: 'a', axis: 'y', at: (p) => [0.5, p.a / 4], set: (_x, y) => ({ a: 4 * y }) }],
    },
  ],
  layout: { main: ['a', 'stoerung', 'eps'] },
  anzeige: ['fixpunkt', 'steigung', 'stabil', 'abweichung'],
})
