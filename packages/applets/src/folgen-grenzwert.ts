// Anhang, Grenzwert einer Folge: lim x_n = L means that for every ε > 0 there is an N with
// |x_n − L| < ε for all n ≥ N. The ε-band lies around L; the terms outside it are coloured,
// and N(ε) is where the sequence enters the band for good.

import { choice, closedForm, index, int, real, zahl, type Series } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

const FOLGEN = {
  inv: { label: '$\\frac{1}{n}$', f: (n: number) => 1 / n, L: 0, Ltex: '0' },
  alt: { label: '$\\frac{(-1)^n}{n}$', f: (n: number) => (-1) ** n / n, L: 0, Ltex: '0' },
  quot: { label: '$\\frac{2n}{n+1}$', f: (n: number) => (2 * n) / (n + 1), L: 2, Ltex: '2' },
  euler: { label: '$\\left(1 + \\frac{1}{n}\\right)^n$', f: (n: number) => (1 + 1 / n) ** n, L: Math.E, Ltex: 'e' },
} as const
type FolgeId = keyof typeof FOLGEN

/** The first n from which on every term lies in the band (checked up to a million), or null. */
function eintritt(id: FolgeId, eps: number): number | null {
  const { f, L } = FOLGEN[id]
  const LAST = 1_000_000
  if (Math.abs(f(LAST) - L) >= eps) return null
  // these sequences approach L monotonically in |x_n − L|: bisect for the entry point
  let lo = 1
  let hi = LAST
  if (Math.abs(f(1) - L) < eps) return 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (Math.abs(f(mid) - L) < eps) hi = mid
    else lo = mid
  }
  return hi
}

const model = closedForm({
  id: 'folgen-grenzwert',
  params: {
    folge: choice(
      'Folge',
      (Object.keys(FOLGEN) as FolgeId[]).map((value) => ({ value, label: FOLGEN[value].label })),
      'inv',
    ),
    eps: real('Toleranz', { latex: '\\varepsilon', min: 0.001, max: 1, step: 0.001, default: 0.1, scale: 'log', limits: { min: 1e-9, reason: 'ε muss positiv sein.' } }),
    N: int('Folgenglieder', { latex: 'n_{\\max}', min: 5, max: 200, default: 40, limits: { min: 1, max: 100_000, reason: 'Mindestens ein Folgenglied, höchstens 100 000.' } }),
  },
  domain: (p) => [1, p.N],
  discrete: true,
  curves: { x: { label: 'x_n', f: (n, p) => FOLGEN[p.folge].f(n) } },
  extraSeries: ({ p, series }) => {
    const { L } = FOLGEN[p.folge]
    const n = series.x.x
    const y = series.x.y
    // the terms outside the band, drawn over the others
    const out = y.map((v) => (Math.abs(v - L) >= p.eps ? v : NaN))
    const band: Series = {
      id: 'band',
      label: 'L \\pm \\varepsilon',
      name: 'Band',
      kind: 'continuous',
      x: Float64Array.of(0, p.N + 1, p.N + 1, 0),
      y: Float64Array.of(L - p.eps, L - p.eps, L + p.eps, L + p.eps),
      role: 'ghost',
      fill: true,
    }
    return [
      { id: 'aussen', label: 'x_n', name: 'außerhalb', kind: 'discrete', x: n, y: out, role: 'secondary', connect: false },
      band,
      { id: 'L', label: 'L', name: 'Grenzwert', kind: 'continuous', x: Float64Array.of(0, p.N + 1), y: Float64Array.of(L, L), role: 'reference' },
    ]
  },
  observables: ({ p, series }) => {
    const { L } = FOLGEN[p.folge]
    const N0 = eintritt(p.folge, p.eps)
    const outside = [...series.x.y].filter((v) => Math.abs(v - L) >= p.eps).length
    return {
      grenzwert: zahl('Grenzwert $L$', L, { marks: [{ kind: 'value', v: L }] }),
      ab: index('im Band ab $N(\\varepsilon)$', N0, {
        note: 'erst nach mehr als einer Million Gliedern',
        marks: N0 === null ? [] : [{ kind: 'time', t: N0 }],
      }),
      aussen: index('Glieder außerhalb (von den gezeigten)', outside),
    }
  },
})

export default defineApplet({
  id: 'folgen-grenzwert',
  horizont: 'N',
  zeitleiste: true,
  model,
  formeln: (p) => [
    { label: 'Folge', tex: String.raw`x_n = {{folge}}` },
    { label: 'Grenzwert', tex: String.raw`\lim_{n \to \infty} x_n = ${FOLGEN[p.folge].Ltex}` },
    { label: 'Bedingung', tex: String.raw`|x_n - L| < {{eps}} \ \text{ für alle } n \ge N(\varepsilon)` },
  ],
  plots: [
    {
      type: 'timeSeriesContinuous',
      series: ['band', 'L', 'x', 'aussen'],
      xLabel: 'n',
      yLabel: 'x_n',
      // the band's upper edge: pull it to make ε larger or smaller
      drag: [{ param: 'eps', axis: 'y', label: 'L + \\varepsilon', at: (p) => [p.N, FOLGEN[p.folge].L + p.eps], set: (_x, y, p) => ({ eps: Math.max(1e-6, y - FOLGEN[p.folge].L) }) }],
    },
  ],
  layout: { main: ['folge', 'eps'] },
  anzeige: ['grenzwert', 'ab', 'aussen'],
})
