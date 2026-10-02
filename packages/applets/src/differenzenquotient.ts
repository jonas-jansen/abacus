// Anhang, Differenzenquotient und Ableitung: the secant through (a, f(a)) and (a + h, f(a + h))
// has slope (f(a + h) − f(a))/h. As h → 0 it turns into the tangent. The second plot shows the
// difference quotient as a function of h: a curve with a hole at h = 0, whose limit is f′(a).

import { choice, closedForm, real, sample, zahl, type Series } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'
import { FUNKTIONEN, funktionOptionen, inDomain, type FunktionId } from './funktionen'

const IDS = ['x2', 'x3', 'poly', 'inv', 'sqrt', 'exp', 'sin'] as const satisfies readonly FunktionId[]
const H_MAX = 2

type P = { f: FunktionId; a: number; h: number }

/** A line through (x0, y0) with slope m, drawn across [lo, hi]. */
const line = (x0: number, y0: number, m: number, lo: number, hi: number) => ({ x: Float64Array.of(lo, hi), y: Float64Array.of(y0 + m * (lo - x0), y0 + m * (hi - x0)) })

const quotient = (p: P, h: number) => {
  const { f } = FUNKTIONEN[p.f]
  return (f(p.a + h) - f(p.a)) / h
}

const model = closedForm({
  id: 'differenzenquotient',
  params: {
    f: choice('Funktion', funktionOptionen(IDS), 'x2'),
    a: real('Stelle', { latex: 'a', min: -2, max: 2, step: 0.01, default: 1 }),
    h: real('Schrittweite', { latex: 'h', min: -H_MAX, max: H_MAX, step: 0.001, default: 1 }),
  },
  // a and a + h stay where f is defined (1/x and √x only for x > 0)
  normalize: (p) => {
    const a = inDomain(p.f, p.a)
    // h only changes if a + h would leave the domain (recomputing it would add round-off)
    const h = inDomain(p.f, a + p.h) === a + p.h ? p.h : inDomain(p.f, a + p.h) - a
    return a === p.a && h === p.h ? p : { ...p, a, h }
  },
  constraintNote: 'a und a + h liegen im Definitionsbereich von f',
  domain: (p) => FUNKTIONEN[p.f].domain,
  curves: { f: { label: 'f(x)', f: (x, p) => FUNKTIONEN[p.f].f(x) } },
  extraSeries: ({ p, detail }) => {
    const F = FUNKTIONEN[p.f]
    const [lo, hi] = F.domain
    const fa = F.f(p.a)
    const out: Series[] = [{ id: 'tangente', label: 't(x)', name: 'Tangente', kind: 'continuous', ...line(p.a, fa, F.df(p.a), lo, hi), role: 'reference' }]
    if (p.h !== 0) out.push({ id: 'sekante', label: 's(x)', name: 'Sekante', kind: 'continuous', ...line(p.a, fa, quotient(p, p.h), lo, hi), role: 'secondary' })
    // the difference quotient as a function of h, undefined at h = 0
    // only where a + h lies in the domain of f
    // the hole at h = 0 is left visibly open: the limit is where the dashed line f'(a) meets it
    const [h0, h1] = detail?.x ? [Math.max(-H_MAX, detail.x[0]), Math.min(H_MAX, detail.x[1])] : [-H_MAX, H_MAX]
    // the hole at h = 0 stays visibly open at every zoom
    const hole = Math.min(0.04, (h1 - h0) * 0.01)
    const g = sample((h) => (Math.abs(h) < hole || p.a + h < lo || p.a + h > hi ? NaN : quotient(p, h)), h0, h1, 401)
    out.push(
      { id: 'g', label: 'D(h)', name: 'Differenzenquotient', kind: 'continuous', x: g.x, y: g.y, role: 'secondary' },
      { id: 'grenze', label: "f'(a)", name: 'Ableitung', kind: 'continuous', x: Float64Array.of(-H_MAX, H_MAX), y: Float64Array.of(F.df(p.a), F.df(p.a)), role: 'reference' },
    )
    return out
  },
  observables: ({ p }) => {
    const F = FUNKTIONEN[p.f]
    const d = p.h === 0 ? null : quotient(p, p.h)
    return {
      quotient: zahl('Differenzenquotient $D(h)$', d, { note: 'bei h = 0 nicht definiert', marks: d === null ? [] : [{ kind: 'point', x: p.h, y: d, in: 'map' }] }),
      ableitung: zahl("Ableitung $f'(a)$", F.df(p.a), { marks: [{ kind: 'line', x: p.a, y: F.f(p.a), slope: F.df(p.a), in: 'map' }] }),
      abstand: zahl("$|D(h) - f'(a)|$", d === null ? null : Math.abs(d - F.df(p.a)), { digits: 3, note: 'bei h = 0 nicht definiert' }),
    }
  },
})

export default defineApplet({
  id: 'differenzenquotient',
  model,
  formeln: [
    { label: 'Funktion', tex: String.raw`f(x) = {{f}}` },
    { label: 'Differenzenquotient', tex: String.raw`D(h) = \frac{f({{a}} + {{h}}) - f({{a}})}{{{h}}}` },
    { label: 'Ableitung', tex: String.raw`f'(a) = \lim_{h \to 0} D(h)` },
  ],
  plots: [
    {
      type: 'functionGraph',
      series: ['f', 'tangente', 'sekante'],
      xLabel: 'x',
      yLabel: 'f(x)',
      drag: [
        { param: 'a', axis: 'x', at: (p) => [p.a, FUNKTIONEN[p.f].f(p.a)], set: (x) => ({ a: x }) },
        { param: 'h', axis: 'x', label: 'a + h', at: (p) => [p.a + p.h, FUNKTIONEN[p.f].f(p.a + p.h)], set: (x, _y, p) => ({ h: x - p.a }) },
      ],
    },
    {
      type: 'functionGraph',
      series: ['g', 'grenze'],
      xLabel: 'h',
      yLabel: 'D(h)',
      x: [-H_MAX, H_MAX],
      drag: [{ param: 'h', axis: 'x', at: (p) => (p.h === 0 ? null : [p.h, quotient(p, p.h)]), set: (x) => ({ h: x }) }],
    },
  ],
  anzeige: ['quotient', 'ableitung', 'abstand'],
})
