// Anhang, komplexe Zahlen: z = a + b i as a point (arrow) in the plane. The sum adds the
// arrows (a parallelogram); the product multiplies the lengths and adds the angles; the powers
// zⁿ wind around the origin — outwards for |z| > 1, inwards for |z| < 1. That is exactly what
// complex eigenvalues do to linear systems.

import { choice, defineModel, int, category, list, point, type Observable, type Point, type Series } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

type Op = 'summe' | 'produkt' | 'potenz'
type P = { op: Op; z: Point; w: Point; n: number }

const mul = ([a, b]: Point, [c, d]: Point): Point => [a * c - b * d, a * d + b * c]
const betrag = ([a, b]: Point) => Math.hypot(a, b)
/** The angle in degrees, in (−180°, 180°]. */
const winkel = ([a, b]: Point) => (Math.atan2(b, a) * 180) / Math.PI

const pfeil = (id: string, label: string, to: Point, role: Series['role'], from: Point = [0, 0]): Series => ({
  id,
  label,
  kind: 'continuous',
  x: Float64Array.of(from[0], to[0]),
  y: Float64Array.of(from[1], to[1]),
  role,
  arrow: true,
})

const text = ([a, b]: Point) => {
  const f = (v: number) => (Math.round(v * 1000) / 1000).toString().replace('-', '−')
  return `${f(a)} ${b < 0 ? '−' : '+'} ${f(Math.abs(b))} i`
}

/** Points as the two series a phase plane plots against each other (index k as "time"). */
const bahn = (pts: Point[], role: Series['role']): Series[] => {
  const k = Float64Array.from(pts, (_, i) => i)
  return [
    { id: 're', label: '\\mathrm{Re}', kind: 'discrete', x: k, y: Float64Array.from(pts, (q) => q[0]), role },
    { id: 'im', label: '\\mathrm{Im}', kind: 'discrete', x: k, y: Float64Array.from(pts, (q) => q[1]), role },
  ]
}

function ergebnis(p: P): Point {
  if (p.op === 'summe') return [p.z[0] + p.w[0], p.z[1] + p.w[1]]
  if (p.op === 'produkt') return mul(p.z, p.w)
  let r: Point = [1, 0]
  for (let k = 0; k < p.n; k++) r = mul(r, p.z)
  return r
}

const model = defineModel({
  id: 'komplexe-zahlen',
  kind: 'closedForm',
  params: {
    op: choice(
      'Rechnung',
      [
        { value: 'summe', label: '$z + w$' },
        { value: 'produkt', label: '$z \\cdot w$' },
        { value: 'potenz', label: '$z^n$' },
      ],
      'produkt',
    ),
    z: point('erste Zahl', { latex: 'z', xBounds: [-3, 3], yBounds: [-3, 3], default: [1.5, 0.5] }),
    w: point('zweite Zahl', { latex: 'w', xBounds: [-3, 3], yBounds: [-3, 3], default: [0.5, 1.2] }),
    n: int('Exponent', { latex: 'n', min: 1, max: 20, default: 6, limits: { min: 0, max: 200, reason: 'Exponent zwischen 0 und 200.' } }),
  },
  run(p: P, opts) {
    const e = ergebnis(p)
    const series: Series[] = []
    // the unit circle for orientation
    const k = Float64Array.from({ length: 121 }, (_, i) => (i * 2 * Math.PI) / 120)
    series.push({ id: 'kreis', label: '|z| = 1', kind: 'continuous', x: k.map(Math.cos), y: k.map(Math.sin), role: 'ghost' })
    if (p.op === 'potenz') {
      // z⁰, z¹, …, zⁿ joined: the spiral
      const pts: Point[] = [[1, 0]]
      for (let j = 0; j < p.n; j++) pts.push(mul(pts[pts.length - 1], p.z))
      series.push(...bahn(pts, 'primary'))
      series.push(pfeil('z', 'z', p.z, 'primary'), pfeil('e', 'z^n', e, 'secondary'))
    } else {
      series.push(pfeil('z', 'z', p.z, 'primary'), pfeil('w', 'w', p.w, 'tertiary'), pfeil('e', p.op === 'summe' ? 'z + w' : 'z\\,w', e, 'secondary'))
      if (p.op === 'summe') {
        // the parallelogram: w moved to the tip of z, and z to the tip of w
        series.push({
          id: 'hilfe',
          label: '',
          kind: 'continuous',
          x: Float64Array.of(p.z[0], e[0], NaN, p.w[0], e[0]),
          y: Float64Array.of(p.z[1], e[1], NaN, p.w[1], e[1]),
          role: 'ghost',
        })
      }
      series.push(...bahn([e], 'secondary'))
    }
    const observables: Record<string, Observable> = {}
    if (opts.observables !== false) {
      observables.ergebnis = category('Ergebnis', text(e), { marks: [{ kind: 'point', x: e[0], y: e[1], in: 'phase' }] })
      // the result's symbol: z + w, z w or zⁿ
      const r = p.op === 'summe' ? 'z + w' : p.op === 'produkt' ? 'z\\,w' : 'z^n'
      const potenz = p.op === 'potenz'
      observables.betrag = list('Beträge', potenz ? [betrag(p.z), betrag(e)] : [betrag(p.z), betrag(p.w), betrag(e)], {
        digits: 3,
        names: potenz ? ['|z|', '|z^n|'] : ['|z|', '|w|', `|${r}|`],
      })
      observables.winkel = list('Winkel', potenz ? [winkel(p.z), winkel(e)] : [winkel(p.z), winkel(p.w), winkel(e)], {
        digits: 3,
        unit: '^\\circ',
        names: potenz ? ['\\arg z', '\\arg z^n'] : ['\\arg z', '\\arg w', `\\arg(${r})`],
      })
    }
    return { series, observables, meta: {} }
  },
})

export default defineApplet({
  id: 'komplexe-zahlen',
  model,
  formulas: (p) => [
    { label: 'Zahlen', tex: String.raw`z = {{#z.0}} {{#+z.1}}\,i` + (p.op === 'potenz' ? '' : String.raw` \\ w = {{#w.0}} {{#+w.1}}\,i`) },
    {
      label: 'Rechnung',
      tex:
        p.op === 'summe'
          ? String.raw`{{op}} \\ z + w = (a_1 + a_2) + (b_1 + b_2)\,i`
          : p.op === 'produkt'
            ? String.raw`{{op}} \\ |z\,w| = |z|\,|w|, \quad \arg(z\,w) = \arg z + \arg w`
            : String.raw`{{op}} \\ |z^{{{n}}}| = |z|^{{{n}}}, \quad \arg(z^{{{n}}}) = {{n}}\,\arg z`,
    },
  ],
  plots: [
    {
      type: 'phasePlane',
      xSeries: 're',
      ySeries: 'im',
      start: false,
      overlay: ['kreis', 'hilfe', 'z', 'w', 'e'],
      xLabel: 'Re',
      yLabel: 'Im',
      x: [-4, 4],
      y: [-4, 4],
      drag: [
        { param: 'z', axis: 'xy' },
        { param: 'w', axis: 'xy', at: (p) => (p.op === 'potenz' ? null : p.w) },
      ],
    },
  ],
  layout: { main: ['op', 'z', 'w', 'n'], visible: { w: (p) => p.op !== 'potenz', n: (p) => p.op === 'potenz' } },
  readouts: ['ergebnis', 'betrag', 'winkel'],
})
