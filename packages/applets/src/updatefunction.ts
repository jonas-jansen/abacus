// MATLAB: app_updatefunction — the update function itself, before any sequence: linear
// f(x) = a x + b or quadratic f(x) = x + r (1 − x/K) x. Roots, fixed points (where the graph
// meets the diagonal) and the slope are read off the graph.

import { choice, closedForm, derivative, fixedPoints, liste, real, roots, zahl } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

type P = { form: 'linear' | 'quadratisch'; a: number; b: number; r: number; K: number }
const f = (x: number, p: P) => (p.form === 'linear' ? p.a * x + p.b : x + p.r * (1 - x / p.K) * x)
const domain = (p: P): [number, number] => (p.form === 'linear' ? [-5, 5] : [-0.25 * p.K, 1.5 * p.K])

const model = closedForm({
  id: 'updatefunction',
  params: {
    form: choice(
      'Form',
      [
        { value: 'linear', label: 'linear' },
        { value: 'quadratisch', label: 'quadratisch' },
      ],
      'linear',
    ),
    a: real('Steigung', { latex: 'a', min: -4, max: 4, step: 0.05, default: 0.5 }),
    b: real('Achsenabschnitt', { latex: 'b', min: -4, max: 4, step: 0.05, default: 1 }),
    r: real('Wachstumsrate', { latex: 'r', min: -1, max: 4, step: 0.05, default: 1 }),
    K: real('Kapazität', { latex: 'K', min: 0.1, max: 10, step: 0.1, default: 5, limits: { min: 1e-6, reason: 'K steht im Nenner und muss positiv sein.' } }),
  },
  domain,
  curves: {
    f: { label: 'f(x)', f: (x, p) => f(x, p) },
  },
  observables: ({ p, domain: [lo, hi] }) => {
    const g = (x: number) => f(x, p)
    const zeros = roots(g, lo, hi)
    const fps = fixedPoints(g, lo, hi).map((q) => q.x)
    return {
      nullstellen: liste('Nullstellen', zeros, {
        note: 'keine im Bild',
        marks: zeros.map((x, item) => ({ kind: 'point', x, y: 0, in: 'map', item })),
      }),
      fixpunkte: liste('Fixpunkte $f(x^*) = x^*$', fps, {
        marks: fps.map((v, item) => ({ kind: 'value', v, item })),
      }),
      steigung0: zahl("Steigung $f'(0)$", derivative(g, 0), { digits: 3, marks: [{ kind: 'line', x: 0, y: g(0), slope: derivative(g, 0), in: 'map' }] }),
    }
  },
})

export default defineApplet({
  id: 'updatefunction',
  model,
  formeln: (p) => [
    {
      label: 'Update-Funktion',
      tex:
        p.form === 'linear'
          ? String.raw`{{form}} \\ f(x) = {{a}}{{*}}x {{+b}}`
          : String.raw`{{form}} \\ f(x) = x {{+r}}\left(1 - \frac{x}{{{K}}}\right) x`,
    },
  ],
  plots: [
    {
      type: 'functionGraph',
      diagonal: true,
      xLabel: 'x',
      yLabel: 'f(x)',
      x: domain,
      y: domain,
      drag: [
        { param: 'b', axis: 'y', at: (p) => (p.form === 'linear' ? [0, p.b] : null) },
        { param: 'a', axis: 'y', at: (p) => (p.form === 'linear' ? [3, 3 * p.a + p.b] : null), set: (_x, y, p) => ({ a: (y - p.b) / 3 }) },
        // f(K) = K: the capacity is a fixed point on the diagonal
        { param: 'K', axis: 'x', at: (p) => (p.form === 'quadratisch' ? [p.K, p.K] : null), set: (x) => ({ K: x }) },
        // f(K/2) = K/2 + r·K/4
        { param: 'r', axis: 'y', at: (p) => (p.form === 'quadratisch' ? [p.K / 2, p.K / 2 + (p.r * p.K) / 4] : null), set: (_x, y, p) => ({ r: (4 * (y - p.K / 2)) / p.K }) },
      ],
    },
  ],
  layout: {
    main: ['form', 'a', 'b', 'r', 'K'],
    sichtbar: {
      a: (p) => p.form === 'linear',
      b: (p) => p.form === 'linear',
      r: (p) => p.form === 'quadratisch',
      K: (p) => p.form === 'quadratisch',
    },
  },
  anzeige: ['nullstellen', 'fixpunkte', 'steigung0'],
})
