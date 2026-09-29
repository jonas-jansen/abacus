// MATLAB: app_linearsystem_phase_discrete — x_{n+1} = A x_n in the plane. The orbit is A^n x₀;
// it shrinks to 0 exactly when every eigenvalue has |λ| < 1 (spectral radius < 1).

import { iterationN, klasse, point, real, schritte, zahl } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'
import { eigen, eigenReadout, ORIGIN, spectralRadius } from './linear2'

const entry = (label: string, latex: string, def: number) => real(label, { latex, min: -1, max: 1, step: 0.01, default: def })

const model = iterationN({
  id: 'linearsystem-discrete',
  params: {
    a: entry('oben links', 'a_{11}', 0),
    b: entry('oben rechts', 'a_{12}', 0.25),
    c: entry('unten links', 'a_{21}', -0.5),
    d: entry('unten rechts', 'a_{22}', 0),
    start: point('Anfangswert', { latex: 'x_0', xBounds: [-2, 2], yBounds: [-2, 2], default: [1, 0] }),
    N: schritte('Schritte', { latex: 'N', default: 25, max: 100 }),
  },
  components: [
    { id: 'x1', label: 'x_{1,n}', role: 'primary' },
    { id: 'x2', label: 'x_{2,n}', role: 'secondary' },
  ],
  start: (p) => p.start,
  step: ([u, v], p) => [p.a * u + p.b * v, p.c * u + p.d * v],
  horizon: (p) => p.N,
  // the columns of A, i.e. where the unit vectors go, as arrows from the origin
  extraSeries: ({ p }) => [
    { id: 'Ae1', label: 'A e_1', kind: 'continuous', x: Float64Array.of(0, p.a), y: Float64Array.of(0, p.c), role: 'tertiary' },
    { id: 'Ae2', label: 'A e_2', kind: 'continuous', x: Float64Array.of(0, p.b), y: Float64Array.of(0, p.d), role: 'tertiary' },
  ],
  observables: ({ p }) => {
    const e = eigen(p.a, p.b, p.c, p.d)
    const rho = spectralRadius(e)
    return {
      eigenwerte: eigenReadout(p.a, p.b, p.c, p.d),
      radius: zahl('Spektralradius $\\max |\\lambda|$', rho, { digits: 3 }),
      verhalten: klasse('Die Folge', rho < 1 - 1e-12 ? 'geht gegen 0' : rho > 1 + 1e-12 ? 'wächst (fast immer)' : 'Grenzfall |λ| = 1', { marks: [ORIGIN] }),
      form: klasse('Bahn', e.complex ? 'dreht sich' : e.real.some((l) => l < 0) ? 'springt hin und her' : 'geradlinig'),
    }
  },
})

export default defineApplet({
  id: 'linearsystem-discrete',
  titel: 'Lineare Abbildung in der Ebene',
  kurz: 'Immer wieder mit derselben Matrix multiplizieren: Spirale, Sprung oder Gerade.',
  model,
  horizont: 'N',
  formeln: [
    { label: 'System', tex: String.raw`x(n+1) = \begin{pmatrix} {{a}} & {{b}} \\ {{c}} & {{d}} \end{pmatrix} x(n)` },
    { label: 'Start', tex: String.raw`x(0) = {{#start}}` },
  ],
  plots: [
    {
      type: 'phasePlane',
      xSeries: 'x1',
      ySeries: 'x2',
      overlay: ['Ae1', 'Ae2'],
      xLabel: 'x_1',
      yLabel: 'x_2',
      x: [-2, 2],
      y: [-2, 2],
      drag: [
        { param: 'start', axis: 'xy' },
        // the first column of A is the image of (1, 0), the second that of (0, 1)
        { param: 'a', also: ['c'], label: 'A e_1', axis: 'xy', at: (p) => [p.a, p.c], set: (x, y) => ({ a: x, c: y }) },
        { param: 'b', also: ['d'], label: 'A e_2', axis: 'xy', at: (p) => [p.b, p.d], set: (x, y) => ({ b: x, d: y }) },
      ],
    },
    { type: 'timeSeriesDiscrete', series: ['x1', 'x2'], xLabel: 'n', yLabel: 'x_n', y: [-2, 2] },
  ],
  layout: { main: ['a', 'b', 'c', 'd'] },
  anzeige: ['eigenwerte', 'radius', 'verhalten', 'form'],
})
