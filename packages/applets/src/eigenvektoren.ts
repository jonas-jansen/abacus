// Anhang, Eigenwerte und Eigenvektoren: A·v usually points somewhere else than v. For special
// directions it does not — there A·v = λ·v, and λ says how much v is stretched (or flipped).
// The columns of A (the images of the unit vectors) can be dragged too; the parallelogram they
// span has the area |det A|.

import { closedForm, klasse, point, real, zahl, type Point, type Series } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'
import { eigenReadout } from './linear2'

const entry = (label: string, latex: string, def: number) => real(label, { latex, min: -5, max: 5, step: 0.1, default: def })

type P = { a: number; b: number; c: number; d: number; v: Point }
const Av = (p: P): Point => [p.a * p.v[0] + p.b * p.v[1], p.c * p.v[0] + p.d * p.v[1]]

/** Angle between v and A v in degrees (0 … 180). */
function winkel(p: P): number | null {
  const [x, y] = Av(p)
  const n1 = Math.hypot(...p.v)
  const n2 = Math.hypot(x, y)
  if (n1 === 0 || n2 === 0) return null
  const cos = (p.v[0] * x + p.v[1] * y) / (n1 * n2)
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI
}

const arrow = (id: string, label: string, [x, y]: Point, role: Series['role']): Series => ({
  id,
  label,
  kind: 'continuous',
  x: Float64Array.of(0, x),
  y: Float64Array.of(0, y),
  role,
  arrow: true,
})

const model = closedForm({
  id: 'eigenvektoren',
  params: {
    a: entry('oben links', 'a_{11}', 4),
    b: entry('oben rechts', 'a_{12}', 1),
    c: entry('unten links', 'a_{21}', 3),
    d: entry('unten rechts', 'a_{22}', 2),
    v: point('Vektor', { latex: '\\mathbf{v}', xBounds: [-3, 3], yBounds: [-3, 3], default: [-1, 1.5] }),
  },
  domain: [0, 1],
  curves: {},
  extraSeries: ({ p }) => [
    {
      // the parallelogram spanned by the columns: area |det A|
      id: 'det',
      label: '|\\det A|',
      kind: 'continuous',
      x: Float64Array.of(0, p.a, p.a + p.b, p.b, 0),
      y: Float64Array.of(0, p.c, p.c + p.d, p.d, 0),
      role: 'ghost',
      fill: true,
    },
    // the columns stay in the background: v and A v are the actors
    arrow('s1', 'A\\mathbf{e}_1', [p.a, p.c], 'ghost'),
    arrow('s2', 'A\\mathbf{e}_2', [p.b, p.d], 'ghost'),
    arrow('v', '\\mathbf{v}', p.v, 'primary'),
    arrow('Av', 'A\\mathbf{v}', Av(p), 'secondary'),
  ],
  observables: ({ p }) => {
    const w = winkel(p)
    const n = Math.hypot(...p.v)
    const parallel = w !== null && (w < 1 || w > 179)
    return {
      winkel: zahl('Winkel zwischen $\\mathbf{v}$ und $A\\mathbf{v}$ (Grad)', w, { digits: 3, note: 'v = 0 oder A v = 0' }),
      faktor: zahl('Streckung $|A\\mathbf{v}| / |\\mathbf{v}|$', n === 0 ? null : Math.hypot(...Av(p)) / n, { digits: 3 }),
      eigen: klasse('$\\mathbf{v}$ ist', parallel ? 'ein Eigenvektor' : 'kein Eigenvektor'),
      eigenwerte: eigenReadout(p.a, p.b, p.c, p.d),
      det: zahl('Determinante $\\det A$', p.a * p.d - p.b * p.c),
    }
  },
})

export default defineApplet({
  id: 'eigenvektoren',
  titel: 'Eigenvektoren: wann A v in dieselbe Richtung zeigt',
  kurz: 'Drehen Sie v, bis A v parallel liegt – dann ist v ein Eigenvektor.',
  kapitel: 'Anhang',
  folien: '56–57, 64, 80–91',
  model,
  formeln: [
    { label: 'Matrix', tex: String.raw`A = \begin{pmatrix} {{a}} & {{b}} \\ {{c}} & {{d}} \end{pmatrix}` },
    { label: 'Vektor', tex: String.raw`\mathbf{v} = {{#v}}` },
    { label: 'Eigenvektor', tex: String.raw`A\mathbf{v} = \lambda\mathbf{v}` },
  ],
  plots: [
    {
      type: 'phasePlane',
      overlay: ['det', 's1', 's2', 'v', 'Av'],
      xLabel: 'x_1',
      yLabel: 'x_2',
      x: [-6, 6],
      y: [-6, 6],
      drag: [
        { param: 'v', axis: 'xy' },
        { param: 'a', also: ['c'], label: 'A\\mathbf{e}_1', axis: 'xy', at: (p) => [p.a, p.c], set: (x, y) => ({ a: x, c: y }) },
        { param: 'b', also: ['d'], label: 'A\\mathbf{e}_2', axis: 'xy', at: (p) => [p.b, p.d], set: (x, y) => ({ b: x, d: y }) },
      ],
    },
  ],
  layout: { main: ['a', 'b', 'c', 'd', 'v'] },
  anzeige: ['winkel', 'faktor', 'eigen', 'eigenwerte', 'det'],
})
