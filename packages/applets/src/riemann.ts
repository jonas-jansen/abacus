// Anhang, das bestimmte Integral: n rectangles of width Δx = (b − a)/n under f approximate the
// area. With more rectangles the sum approaches the integral F(b) − F(a) — for midpoints the
// error shrinks like 1/n², for left or right points like 1/n.

import { choice, closedForm, int, real, zahl, type Series } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'
import { FUNKTIONEN, funktionOptionen, inDomain, type FunktionId } from './funktionen'

const IDS = ['inv', 'x2', 'lin', 'sin', 'exp', 'sqrt'] as const satisfies readonly FunktionId[]
type Regel = 'mitte' | 'links' | 'rechts'
type P = { f: FunktionId; a: number; b: number; n: number; regel: Regel }

const OFFSET: Record<Regel, number> = { links: 0, mitte: 0.5, rechts: 1 }

/** The plot window: [a, b] with half its width on either side, within the domain of f. */
function fenster(p: P): [number, number] {
  const [lo, hi] = FUNKTIONEN[p.f].domain
  const w = (p.b - p.a) / 2
  return [Math.max(lo, p.a - w), Math.min(hi, p.b + w)]
}

function summe(p: P): number {
  const { f } = FUNKTIONEN[p.f]
  const dx = (p.b - p.a) / p.n
  let s = 0
  for (let i = 0; i < p.n; i++) s += f(p.a + (i + OFFSET[p.regel]) * dx)
  return s * dx
}

const model = closedForm({
  id: 'riemann',
  params: {
    f: choice('Funktion', funktionOptionen(IDS), 'inv'),
    a: real('untere Grenze', { latex: 'a', min: -3, max: 3, step: 0.05, default: 1 }),
    b: real('obere Grenze', { latex: 'b', min: -3, max: 4, step: 0.05, default: 2 }),
    n: int('Rechtecke', { latex: 'n', min: 1, max: 100, default: 5, limits: { min: 1, max: 5000, reason: 'Zwischen 1 und 5000 Rechtecken.' } }),
    regel: choice(
      'Stützstelle',
      [
        { value: 'mitte', label: 'Mitte' },
        { value: 'links', label: 'links' },
        { value: 'rechts', label: 'rechts' },
      ],
      'mitte',
    ),
  },
  normalize: (p) => {
    const a = inDomain(p.f, p.a)
    const b = Math.max(inDomain(p.f, p.b), a + 0.05)
    return a === p.a && b === p.b ? p : { ...p, a, b }
  },
  constraintNote: 'a < b, beide im Definitionsbereich von f',
  domain: (p) => fenster(p),
  curves: { f: { label: 'f(x)', f: (x, p) => FUNKTIONEN[p.f].f(x) } },
  extraSeries: ({ p }) => {
    const { f } = FUNKTIONEN[p.f]
    const dx = (p.b - p.a) / p.n
    const x = new Float64Array(p.n * 5)
    const y = new Float64Array(p.n * 5)
    for (let i = 0; i < p.n; i++) {
      const l = p.a + i * dx
      const h = f(l + OFFSET[p.regel] * dx)
      x.set([l, l, l + dx, l + dx, NaN], 5 * i)
      y.set([0, h, h, 0, NaN], 5 * i)
    }
    const r: Series = { id: 'rechtecke', label: '\\textstyle\\sum f(\\xi_i)\\,\\Delta x', name: 'Rechtecke', kind: 'continuous', x, y, role: 'tertiary', fill: true }
    return [r]
  },
  observables: ({ p }) => {
    const F = FUNKTIONEN[p.f]
    const S = summe(p)
    const I = F.F(p.b) - F.F(p.a)
    const err = Math.abs(S - I)
    const order = p.regel === 'mitte' ? 2 : 1
    return {
      summe: zahl('Rechtecksumme', S, { digits: 6 }),
      integral: zahl('Integral $F(b) - F(a)$', I, { digits: 6 }),
      fehler: zahl('Fehler', err, { digits: 3 }),
      skaliert: zahl(order === 2 ? 'Fehler $\\cdot\\, n^2$ (bleibt fast gleich)' : 'Fehler $\\cdot\\, n$ (bleibt fast gleich)', err * p.n ** order, { digits: 3 }),
    }
  },
})

export default defineApplet({
  id: 'riemann',
  titel: 'Integral als Grenzwert von Rechtecksummen',
  kurz: 'Immer schmalere Rechtecke füllen die Fläche unter der Kurve immer genauer.',
  kapitel: 'Anhang',
  folien: '100–107',
  model,
  formeln: [
    { label: 'Näherung', tex: String.raw`\int_{{{a}}}^{{{b}}} f(x)\,dx \approx \sum_{i=1}^{{{n}}} f(\xi_i)\,\Delta x \\ f(x) = {{f}}` },
    { label: 'Rechtecke', tex: String.raw`\Delta x = \frac{{{b}} - {{a}}}{{{n}}} \\ \xi_i\ \text{ in der } {{regel}}` },
  ],
  plots: [
    {
      type: 'functionGraph',
      series: ['rechtecke', 'f'],
      xLabel: 'x',
      yLabel: 'f(x)',
      drag: [
        { param: 'a', axis: 'x', at: (p) => [p.a, 0], set: (x) => ({ a: x }) },
        { param: 'b', axis: 'x', at: (p) => [p.b, 0], set: (x) => ({ b: x }) },
      ],
    },
  ],
  layout: { main: ['f', 'n', 'regel', 'a', 'b'] },
  anzeige: ['summe', 'integral', 'fehler', 'skaliert'],
})
