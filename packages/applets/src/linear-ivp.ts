// MATLAB: app_linear_IVP — the same equation x' = a x + b, now with x(0) = x₀ given: the
// constant is fixed, C = x₀ + b/a, and exactly one curve remains.

import { closedForm, klasse, real, zahl } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'
import { general } from './linear-family'

const model = closedForm({
  id: 'linear-ivp',
  params: {
    a: real('Koeffizient', { latex: 'a', min: -2, max: 2, step: 0.01, default: -0.5 }),
    b: real('Zufluss', { latex: 'b', min: -5, max: 5, step: 0.05, default: 1 }),
    x0: real('Anfangswert', { latex: 'x_0', min: -3, max: 3, step: 0.05, default: 0.5 }),
  },
  domain: [0, 10],
  curves: {
    x: { label: 'x(t)', f: (t, p) => (Math.abs(p.a) < 1e-9 ? p.x0 + p.b * t : general(t, p.a, p.b, p.x0 + p.b / p.a)) },
  },
  slope: (_t, x, p) => p.a * x + p.b,
  observables: ({ p }) => {
    const eq = Math.abs(p.a) < 1e-9 ? null : -p.b / p.a
    return {
      konstante: zahl('Konstante $C = x_0 + b/a$', eq === null ? null : p.x0 + p.b / p.a, { note: 'für a = 0: x(t) = x₀ + b t' }),
      gleichgewicht: zahl('Gleichgewicht $-b/a$', eq, { note: 'keines für a = 0', marks: eq === null ? [] : [{ kind: 'value', v: eq }] }),
      stabilitaet: klasse('Gleichgewicht ist', p.a < 0 ? 'stabil' : p.a > 0 ? 'instabil' : null, { note: 'kein Gleichgewicht' }),
    }
  },
})

export default defineApplet({
  id: 'linear-ivp',
  titel: 'Anfangswertproblem',
  kurz: 'Der Anfangswert legt die Konstante fest – und damit genau eine Lösung.',
  model,
  formeln: [
    { label: 'Gleichung', tex: String.raw`\frac{dx}{dt} = {{a}}{{*}}x {{+b}}` },
    { label: 'Start', tex: String.raw`x(0) = {{x0}}` },
    { label: 'Lösung', tex: String.raw`x(t) = \left({{x0}} + \frac{{{b}}}{{{a}}}\right) e^{{{a}}\,t} - \frac{{{b}}}{{{a}}}` },
  ],
  plots: [
    {
      type: 'timeSeriesContinuous',
      xLabel: 't',
      yLabel: 'x(t)',
      y: [-1, 5],
      field: true,
      drag: [
        { param: 'x0', axis: 'y' },
        { param: 'b', axis: 'y', at: (p) => (Math.abs(p.a) < 1e-9 ? null : [10, -p.b / p.a]), set: (_x, y, p) => ({ b: -p.a * y }) },
      ],
    },
  ],
  zeitleiste: true,
  anzeige: ['konstante', 'gleichgewicht', 'stabilitaet'],
})
