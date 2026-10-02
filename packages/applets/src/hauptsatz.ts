// Anhang, Hauptsatz der Differential- und Integralrechnung: F(x) = ∫ₐˣ f(t) dt is the area
// under f from a to x (below the axis it counts negative). Move x and watch F grow — at the
// rate f(x): F′(x) = f(x). The tangent to F at x has exactly the height of f there as slope.

import { choice, closedForm, real, sample, quantity, type Series } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'
import { FUNCTIONS, functionChoices, inDomain, type FunctionId } from './functions'

const IDS = ['lin', 'x2', 'sin', 'exp', 'inv', 'sqrt'] as const satisfies readonly FunctionId[]
type P = { f: FunctionId; a: number; x: number }

const Fa = (p: P, x: number) => FUNCTIONS[p.f].F(x) - FUNCTIONS[p.f].F(p.a)

const model = closedForm({
  id: 'hauptsatz',
  params: {
    f: choice('Funktion', functionChoices(IDS), 'lin'),
    a: real('untere Grenze', { latex: 'a', min: -3, max: 3, step: 0.05, default: 0 }),
    x: real('obere Grenze', { latex: 'x', min: -3, max: 4, step: 0.01, default: 2.5 }),
  },
  normalize: (p) => {
    const a = inDomain(p.f, p.a)
    const x = inDomain(p.f, p.x)
    return a === p.a && x === p.x ? p : { ...p, a, x }
  },
  constraintNote: 'a und x liegen im Definitionsbereich von f',
  domain: (p) => FUNCTIONS[p.f].domain,
  curves: {
    f: { label: 'f(t)', f: (t, p) => FUNCTIONS[p.f].f(t) },
    F: { label: 'F(x)', name: 'Flächenfunktion', role: 'secondary', f: (t, p) => Fa(p, t) },
  },
  extraSeries: ({ p }) => {
    const F = FUNCTIONS[p.f]
    // the area from a to x, split at the axis: above counts positive, below negative
    const s = sample(F.f, Math.min(p.a, p.x), Math.max(p.a, p.x), 160)
    const part = (keep: (v: number) => number): Float64Array => Float64Array.from([0, ...s.y.map(keep), 0])
    const x = Float64Array.from([s.x[0], ...s.x, s.x[s.x.length - 1]])
    // integrating from right to left (x < a) turns the signs around
    const sign = p.x >= p.a ? 1 : -1
    const up: Series = { id: 'plus', label: '+', name: 'zählt positiv', kind: 'continuous', x, y: part((v) => (sign * v > 0 ? v : 0)), role: 'tertiary', fill: true }
    const down: Series = { id: 'minus', label: '-', name: 'zählt negativ', kind: 'continuous', x, y: part((v) => (sign * v < 0 ? v : 0)), role: 'secondary', fill: true }
    // the tangent to F at x, slope f(x)
    const [lo, hi] = F.domain
    const Fx = Fa(p, p.x)
    const m = F.f(p.x)
    const tangente: Series = {
      id: 'tangente',
      label: 't(x)',
      name: 'Tangente',
      kind: 'continuous',
      x: Float64Array.of(lo, hi),
      y: Float64Array.of(Fx + m * (lo - p.x), Fx + m * (hi - p.x)),
      role: 'reference',
    }
    return [up, down, tangente]
  },
  observables: ({ p }) => {
    const F = FUNCTIONS[p.f]
    const Fx = Fa(p, p.x)
    return {
      F: quantity('Fläche $F(x)$', Fx, { marks: [{ kind: 'point', x: p.x, y: Fx, in: 'map' }] }),
      f: quantity('Steigung $F\'(x) = f(x)$', F.f(p.x), { marks: [{ kind: 'line', x: p.x, y: Fx, slope: F.f(p.x), in: 'map' }] }),
    }
  },
})

export default defineApplet({
  id: 'hauptsatz',
  model,
  formulas: [
    { label: 'Funktion', tex: String.raw`f(x) = {{f}}` },
    { label: 'Flächenfunktion', tex: String.raw`F({{x}}) = \int_{{{a}}}^{{{x}}} f(t)\,dt` },
    { label: 'Hauptsatz', tex: String.raw`F'(x) = f(x)` },
  ],
  plots: [
    {
      type: 'functionGraph',
      series: ['plus', 'minus', 'f'],
      xLabel: 't',
      yLabel: 'f(t)',
      drag: [
        { param: 'a', axis: 'x', at: (p) => [p.a, 0], set: (x) => ({ a: x }) },
        { param: 'x', axis: 'x', at: (p) => [p.x, 0], set: (x) => ({ x }) },
      ],
    },
    {
      type: 'functionGraph',
      series: ['F', 'tangente'],
      xLabel: 'x',
      yLabel: 'F(x)',
      drag: [{ param: 'x', axis: 'x', at: (p) => [p.x, Fa(p, p.x)], set: (x) => ({ x }) }],
    },
  ],
  readouts: ['F', 'f'],
})
