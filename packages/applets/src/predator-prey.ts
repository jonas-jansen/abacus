// MATLAB: app_predator_prey — discrete predator–prey model:
//   y₁⁺ = (1 + r) y₁ − r y₁² − γ y₁ y₂   (prey: logistic, eaten)
//   y₂⁺ = γ y₁ y₂                         (predators: live on prey)
// Coexistence y* = (1/γ, r (1 − 1/γ)/γ) exists for γ > 1: below that the predator dies out.

import { behaviour, iterationN, klasse, liste, point, real, schritte } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

export const preyNext = (y1: number, y2: number, r: number, g: number) => (1 + r) * y1 - r * y1 * y1 - g * y1 * y2
export const predNext = (y1: number, y2: number, g: number) => g * y1 * y2

const model = iterationN({
  id: 'predator-prey',
  params: {
    r: real('Wachstumsrate der Beute', { latex: 'r', min: 0, max: 4, step: 0.01, default: 3.1 }),
    gamma: real('Jagderfolg', { latex: '\\gamma', min: 0, max: 2.5, step: 0.01, default: 2.1 }),
    start: point('Start', { latex: 'y(0)', xBounds: [0, 1.2], yBounds: [0, 1.2], default: [0.8, 0.2] }),
    N: schritte('Schritte', { latex: 'N', default: 40, max: 200 }),
  },
  components: [
    { id: 'beute', label: 'y_1', role: 'primary' },
    { id: 'raeuber', label: 'y_2', role: 'secondary' },
  ],
  start: (p) => p.start,
  step: ([y1, y2], p) => [preyNext(y1, y2, p.r, p.gamma), predNext(y1, y2, p.gamma)],
  horizon: (p) => p.N,
  observables: ({ p, x: [y1, y2] }) => {
    const coexist = p.gamma > 1
    const eq = coexist ? [1 / p.gamma, (p.r * (1 - 1 / p.gamma)) / p.gamma] : [1, 0]
    const last = y2[y2.length - 1]
    const v = behaviour(y1)
    return {
      gleichgewicht: liste(coexist ? 'Koexistenz $(y_1^*, y_2^*)$' : 'Gleichgewicht ohne Räuber', eq, {
        marks: [
          { kind: 'value', v: eq[0], item: 0 },
          { kind: 'value', v: eq[1], item: 1 },
          { kind: 'point', x: eq[0], y: eq[1], in: 'phase' },
        ],
      }),
      raeuber: klasse('Räuber', last < 1e-6 ? 'sterben aus' : 'überleben'),
      verhalten: klasse('Beute', v === 'divergent' ? 'explodiert' : v, v === null ? { note: 'kein einfaches Muster' } : {}),
    }
  },
})

export default defineApplet({
  id: 'predator-prey',
  titel: 'Räuber und Beute',
  kurz: 'Zwei Populationen, die voneinander leben – Gleichgewicht, Schwingung oder Aussterben.',
  model,
  formeln: [
    { label: 'System', tex: String.raw`\begin{aligned} y_1(n+1) &= (1 + {{r}})\,y_1(n) - {{r}}{{*}}y_1(n)^2 - {{gamma}}{{*}}y_1(n)\,y_2(n) \\ y_2(n+1) &= {{gamma}}{{*}}y_1(n)\,y_2(n) \end{aligned}` },
    { label: 'Start', tex: String.raw`y(0) = {{start}}, \quad n = 0, \dots, {{N}}` },
  ],
  plots: [
    { type: 'timeSeriesDiscrete', xLabel: 'n', yLabel: 'y_1, y_2', y: [-0.05, 1.6] },
    {
      type: 'phasePlane',
      xSeries: 'beute',
      ySeries: 'raeuber',
      xLabel: 'y_1',
      yLabel: 'y_2',
      x: [0, 1.5],
      y: [0, 1.5],
      drag: [
        { param: 'start', axis: 'xy' },
        // the coexistence point (1/γ, r (1 − 1/γ)/γ): put it somewhere, and γ and r follow
        {
          param: 'gamma',
          also: ['r'],
          label: 'y^*',
          axis: 'xy',
          at: (p) => (p.gamma > 1 ? [1 / p.gamma, (p.r * (1 - 1 / p.gamma)) / p.gamma] : null),
          set: (x, y) => {
            const u = Math.min(0.97, Math.max(0.05, x))
            return { gamma: 1 / u, r: Math.max(0, y) / ((1 - u) * u) }
          },
        },
      ],
    },
  ],
  layout: { main: ['r', 'gamma', 'start'] },
  anzeige: ['gleichgewicht', 'raeuber', 'verhalten'],
})
