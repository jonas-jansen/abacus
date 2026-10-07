// MATLAB: app_arithmetric — x_{n+1} = x_n + b: a constant increment, linear growth or decay.

import { iteration, category, real, steps, quantity } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

const model = iteration({
  id: 'arithmetic',
  params: {
    b: real('Zuwachs', { latex: 'b', min: -2, max: 4, step: 0.1, default: 1 }),
    x0: real('Startwert', { latex: 'x_0', min: 0, max: 40, step: 1, default: 20 }),
    N: steps('Schritte', { latex: 'N', default: 20, max: 60 }),
  },
  start: (p) => p.x0,
  step: (x, p) => x + p.b,
  horizon: (p) => p.N,
  observables: ({ p }) => {
    // x_n = x₀ + b·n: every point lies on this line
    const gerade = [{ kind: 'line', x: 0, y: p.x0, slope: p.b, in: 'time' }] as const
    return {
      zuwachs: quantity('Zuwachs pro Schritt $x_{n+1} - x_n$', p.b, { marks: gerade }),
      verhalten: category('Verhalten', p.b > 0 ? 'wächst' : p.b < 0 ? 'fällt' : 'konstant'),
      null: quantity('erster Wert $\\le 0$ bei $n$', p.b < 0 && p.x0 > 0 ? Math.ceil(p.x0 / -p.b) : null, {
        note: p.x0 <= 0 ? 'schon am Anfang' : 'nie',
        marks: p.b < 0 && p.x0 > 0 ? [{ kind: 'time', t: Math.ceil(p.x0 / -p.b) }, { kind: 'value', v: 0 }] : [],
      }),
    }
  },
})

export default defineApplet({
  id: 'arithmetic',
  model,
  horizon: 'N',
  formulas: [
    { label: 'Vorschrift', tex: String.raw`x_{n+1} = x_n {{+b}}` },
    { label: 'Start', tex: String.raw`x_0 = {{#x0}}` },
    { label: 'Lösung', tex: String.raw`x_n = {{x0}} {{+b}}{{*}}n` },
  ],
  plots: [
    {
      type: 'timeSeriesDiscrete',
      xLabel: 'n',
      yLabel: 'x_n',
      drag: [
        { param: 'x0', axis: 'y' },
        // the last point x_N = x₀ + b·N: dragging it tilts the whole line. It is named for what
        // it is (x_N); the guide shows b as the rise of one step, midway, clear of both handles.
        { param: 'b', axis: 'y', label: (p) => `x_{${p.N}}`, at: (p) => (p.N < 1 ? null : [p.N, p.x0 + p.b * p.N]), set: (_x, y, p) => ({ b: (y - p.x0) / p.N }) },
      ],
      guides: (p) => {
        const k = Math.floor(p.N / 2)
        return p.N < 2 ? [] : [{ kind: 'rise', from: [k, p.x0 + p.b * k], to: [k + 1, p.x0 + p.b * (k + 1)], label: 'b', run: '1' }]
      },
    },
  ],
  readouts: ['zuwachs', 'verhalten', 'null'],
})
