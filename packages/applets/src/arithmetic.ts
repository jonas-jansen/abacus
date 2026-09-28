// MATLAB: app_arithmetric — x_{n+1} = x_n + b: a constant increment, linear growth or decay.

import { iteration, klasse, real, schritte, zahl } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

const model = iteration({
  id: 'arithmetic',
  params: {
    b: real('Zuwachs', { latex: 'b', min: -2, max: 4, step: 0.1, default: 1 }),
    x0: real('Startwert', { latex: 'x_0', min: 0, max: 40, step: 1, default: 20 }),
    N: schritte('Schritte', { latex: 'N', default: 20, max: 60 }),
  },
  start: (p) => p.x0,
  step: (x, p) => x + p.b,
  horizon: (p) => p.N,
  observables: ({ p }) => {
    // x_n = x₀ + b·n: every point lies on this line
    const gerade = [{ kind: 'line', x: 0, y: p.x0, slope: p.b, in: 'time' }] as const
    return {
      zuwachs: zahl('Zuwachs pro Schritt $x_{n+1} - x_n$', p.b, { marks: gerade }),
      verhalten: klasse('Verhalten', p.b > 0 ? 'wächst' : p.b < 0 ? 'fällt' : 'konstant'),
      null: zahl('erster Wert $\\le 0$ bei $n$', p.b < 0 && p.x0 > 0 ? Math.ceil(p.x0 / -p.b) : null, {
        note: p.x0 <= 0 ? 'schon am Anfang' : 'nie',
        marks: p.b < 0 && p.x0 > 0 ? [{ kind: 'time', t: Math.ceil(p.x0 / -p.b) }, { kind: 'value', v: 0 }] : [],
      }),
    }
  },
})

export default defineApplet({
  id: 'arithmetic',
  titel: 'Arithmetische Folge',
  kurz: 'Jeder Schritt addiert denselben Betrag.',
  model,
  plots: [
    {
      type: 'timeSeriesDiscrete',
      xLabel: 'n',
      yLabel: 'x_n',
      drag: [
        { param: 'x0', axis: 'y' },
        // the last point x_N = x₀ + b·N: dragging it tilts the whole line
        { param: 'b', axis: 'y', at: (p) => (p.N < 1 ? null : [p.N, p.x0 + p.b * p.N]), set: (_x, y, p) => ({ b: (y - p.x0) / p.N }) },
      ],
    },
  ],
  anzeige: ['zuwachs', 'verhalten', 'null'],
})
