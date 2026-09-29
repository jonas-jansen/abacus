// MATLAB: app_linear_diff — x' = a x + b has the solutions x(t) = C e^{at} − b/a: one curve for
// every constant C. All of them approach the equilibrium −b/a if a < 0 and flee it if a > 0.

import { closedForm, klasse, linspace, real, zahl, type Series } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

/** x(t) = C e^{at} − b/a, and its limit C + b t for a → 0. */
export const general = (t: number, a: number, b: number, C: number) => (Math.abs(a) < 1e-9 ? C + b * t : C * Math.exp(a * t) - b / a)

const FAMILY = Array.from(linspace(-3, 3, 13))

const model = closedForm({
  id: 'linear-family',
  params: {
    a: real('Koeffizient', { latex: 'a', min: -2, max: 2, step: 0.01, default: -0.5 }),
    b: real('Zufluss', { latex: 'b', min: -5, max: 5, step: 0.05, default: 1 }),
    C: real('Konstante', { latex: 'C', min: -3, max: 3, step: 0.05, default: 1 }),
  },
  domain: [0, 10],
  curves: { x: { label: 'x(t)', f: (t, p) => general(t, p.a, p.b, p.C) } },
  slope: (_t, x, p) => p.a * x + p.b,
  extraSeries: ({ p, series }) => {
    const t = series.x.x
    // the rest of the family, faint, behind the chosen curve
    return FAMILY.filter((C) => Math.abs(C - p.C) > 1e-9).map(
      (C): Series => ({ id: `C${C}`, label: '', kind: 'continuous', x: t, y: t.map((s) => general(s, p.a, p.b, C)), role: 'ghost' }),
    )
  },
  observables: ({ p }) => {
    const eq = Math.abs(p.a) < 1e-9 ? null : -p.b / p.a
    return {
      gleichgewicht: zahl('Gleichgewicht $-b/a$', eq, { note: 'keines für a = 0', marks: eq === null ? [] : [{ kind: 'value', v: eq }] }),
      stabilitaet: klasse('Gleichgewicht ist', p.a < 0 ? 'stabil' : p.a > 0 ? 'instabil' : null, { note: 'kein Gleichgewicht' }),
      start: zahl('Startwert $x(0) = C - b/a$', general(0, p.a, p.b, p.C), { marks: [{ kind: 'point', x: 0, y: general(0, p.a, p.b, p.C), in: 'time' }] }),
    }
  },
})

export default defineApplet({
  id: 'linear-family',
  titel: 'Allgemeine Lösung einer linearen Gleichung',
  kurz: 'Eine Differentialgleichung, unendlich viele Lösungen – die Konstante C wählt eine aus.',
  kapitel: 'III',
  folien: '8–12',
  model,
  formeln: [
    { label: 'Gleichung', tex: String.raw`\frac{dx}{dt} = {{a}}{{*}}x {{+b}}` },
    { label: 'Lösungen', tex: String.raw`x(t) = {{C}}{{*}}e^{{{a}}\,t} - \frac{{{b}}}{{{a}}}` },
    { label: 'Gleichgewicht', tex: String.raw`x^* = -\frac{{{b}}}{{{a}}}` },
  ],
  plots: [
    {
      type: 'timeSeriesContinuous',
      xLabel: 't',
      yLabel: 'x(t)',
      y: [-1, 5],
      legend: false,
      field: true,
      drag: [
        // pick a member of the family by its start
        { param: 'C', axis: 'y', at: (p) => [0, general(0, p.a, p.b, p.C)], set: (_x, y, p) => ({ C: Math.abs(p.a) < 1e-9 ? y : y + p.b / p.a }) },
        // the equilibrium −b/a moves with b
        { param: 'b', axis: 'y', at: (p) => (Math.abs(p.a) < 1e-9 ? null : [10, -p.b / p.a]), set: (_x, y, p) => ({ b: -p.a * y }) },
      ],
    },
  ],
  anzeige: ['gleichgewicht', 'stabilitaet', 'start'],
})
