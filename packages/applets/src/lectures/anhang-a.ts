// Vorlesung, Anhang A (Mathematische Werkzeuge: Grenzwert, Stetigkeit, Ableitung): one applet
// per visualisation of the slides, fully interactive, with the slides' parameters as scenarios.
// For the beamer; registered in ../index.ts, not in the gallery. Several slides share a model
// and differ in their plots and scenarios (the first scenario is what the tab opens with).

import { bool, choice, closedForm, index, int, iteration, quantity, real, sample, steps, type Run, type Series } from '@abacus/applet-core'
import { defineApplet, type AppletModule, type Guide } from '@abacus/applet-ui/define'
import heron from '../heron'

/** A number for a label: at most four decimals, no trailing zeros. */
const num = (v: number) => String(+v.toFixed(4))

/** A straight piece from (x0, y0) to (x1, y1). */
const segment = (id: string, label: string, [x0, y0]: readonly [number, number], [x1, y1]: readonly [number, number], role: Series['role'], extra: Partial<Series> = {}): Series => ({
  id,
  label,
  kind: 'continuous',
  x: Float64Array.of(x0, x1),
  y: Float64Array.of(y0, y1),
  role,
  ...extra,
})
/** Single points: a dot (or with `hollow`, a hole). */
const points = (id: string, label: string, pts: readonly (readonly [number, number])[], role: Series['role'], extra: Partial<Series> = {}): Series => ({
  id,
  label,
  kind: 'discrete',
  x: Float64Array.from(pts, (q) => q[0]),
  y: Float64Array.from(pts, (q) => q[1]),
  role,
  connect: false,
  ...extra,
})

// ------------------------------------------------------- Folien 3–5: Grenzwert einer Folge

const FOLGEN = {
  wechsel: { label: '$1 + \\frac{(-1)^n}{n}$', tex: String.raw`1 + \frac{(-1)^n}{n}`, f: (n: number) => 1 + (-1) ** n / n, L: 1, y: [-0.2, 2.2] },
  inv: { label: '$\\frac{1}{n}$', tex: String.raw`\frac{1}{n}`, f: (n: number) => 1 / n, L: 0, y: [-0.5, 1.15] },
  quot: { label: '$\\frac{2n}{n+1}$', tex: String.raw`\frac{2n}{n+1}`, f: (n: number) => (2 * n) / (n + 1), L: 2, y: [0.7, 2.5] },
} as const
type FolgeId = keyof typeof FOLGEN

/**
 * The index N from which on all terms lie in the band: the last n with |x_n − x̄| ≥ ε (0 if
 * none). The distances shrink with n, so the first n inside the band is found by bisection.
 */
function indexN(id: FolgeId, eps: number): number {
  const { f, L } = FOLGEN[id]
  const inside = (n: number) => Math.abs(f(n) - L) < eps
  if (inside(1)) return 0
  let [lo, hi] = [1, 2]
  while (!inside(hi)) [lo, hi] = [hi, hi * 2]
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (inside(mid)) hi = mid
    else lo = mid
  }
  return lo
}

const grenzwertModel = closedForm({
  id: 'va-grenzwert',
  params: {
    folge: choice('Folge', (Object.keys(FOLGEN) as FolgeId[]).map((value) => ({ value, label: FOLGEN[value].label })), 'wechsel'),
    eps: real('Toleranz', { latex: '\\varepsilon', min: 0.001, max: 1, step: 0.001, default: 0.22, scale: 'log', limits: { min: 1e-6, reason: 'ε muss positiv sein.' } }),
    n: int('Folgenglieder', { latex: 'n_{\\max}', min: 5, max: 200, default: 15 }),
  },
  domain: (p) => [1, p.n],
  discrete: true,
  curves: { x: { label: 'x_n', f: (n, p) => FOLGEN[p.folge].f(n) } },
  extraSeries: ({ p, series }) => {
    const { L, y } = FOLGEN[p.folge]
    const N = indexN(p.folge, p.eps)
    const n = series.x.x
    const right = p.n + 1
    return [
      { id: 'band', label: '\\bar x \\pm \\varepsilon', name: 'Band', kind: 'continuous', x: Float64Array.of(0, right, right, 0), y: Float64Array.of(L - p.eps, L - p.eps, L + p.eps, L + p.eps), role: 'ghost', fill: true },
      segment('L', '\\bar x', [0, L], [right, L], 'reference', { name: 'Grenzwert' }),
      { id: 'vor', label: 'x_n', name: 'bis N', kind: 'discrete', x: n, y: series.x.y.map((v, k) => (n[k] <= N ? v : NaN)), role: 'secondary' },
      { id: 'nach', label: 'x_n', name: 'ab N + 1', kind: 'discrete', x: n, y: series.x.y.map((v, k) => (n[k] > N ? v : NaN)), role: 'primary' },
    ]
  },
  observables: ({ p }) => {
    const N = indexN(p.folge, p.eps)
    return { N: index('Index $N$', N, { marks: [{ kind: 'time', t: N }] }) }
  },
})

const grenzwertApplet = (id: string, title: string, scenarios: { label: string; text?: string; params: Record<string, unknown> }[]) =>
  defineApplet({
    id,
    title,
    summary: '|x_n − x̄| < ε für alle n > N',
    chapter: 'Appendix',
    model: grenzwertModel,
    formulas: (p) => [
      { label: 'Folge', tex: String.raw`x_n = {{folge}}, \quad \bar x = ${FOLGEN[p.folge].L}` },
      { label: 'ab N', tex: String.raw`|x_n - \bar x| < {{eps}} \ \text{ für alle } n > N = ${indexN(p.folge, p.eps)}` },
    ],
    plots: [
      {
        type: 'timeSeriesContinuous',
        series: ['band', 'L', 'vor', 'nach'],
        xLabel: 'n',
        yLabel: 'x_n',
        x: (p) => [0, p.n + 0.5],
        y: (p) => [...FOLGEN[p.folge].y],
        // the band's upper edge: pull it to make ε larger or smaller
        // N, where the sequence enters the band for good
        guides: (p): readonly Guide[] => {
          const N = indexN(p.folge, p.eps)
          const [lo, hi] = FOLGEN[p.folge].y
          return N > 0 && N <= p.n ? [{ kind: 'drop', from: [N, hi], to: [N, lo], label: 'N' }] : []
        },
        drag: [{ param: 'eps', axis: 'y', label: '\\bar x + \\varepsilon', at: (p) => [p.n, FOLGEN[p.folge].L + p.eps], set: (_x, y, p) => ({ eps: Math.max(0.001, y - FOLGEN[p.folge].L) }) }],
      },
    ],
    layout: { main: ['folge', 'eps', 'n'] },
    readouts: ['N'],
    scenarios,
  })

const grenzwert = grenzwertApplet('va-grenzwert', 'Grenzwert: die Idee', [
  { label: 'Folien 3–4', text: 'Ab N = 4 bleiben alle Folgenglieder im Band.', params: { folge: 'wechsel', eps: 0.22, n: 15 } },
  { label: 'ε = 0.1', params: { folge: 'wechsel', eps: 0.1, n: 30 } },
  { label: 'ε = 0.02', params: { folge: 'wechsel', eps: 0.02, n: 80 } },
])

const einsDurchN = grenzwertApplet('va-eins-durch-n', 'Konvergenz der Folge 1/n', [
  { label: 'Folie 5', text: 'ε = 0.25: N = 1/ε = 4.', params: { folge: 'inv', eps: 0.25, n: 15 } },
  { label: 'ε = 0.1', text: 'N = 10.', params: { folge: 'inv', eps: 0.1, n: 20 } },
  { label: 'ε = 0.01', text: 'N = 100.', params: { folge: 'inv', eps: 0.01, n: 150 } },
])

// ----------------------------------------------------- Folien 6–7: konvergent oder divergent?

const folgenModel = iteration({
  id: 'va-folgen',
  params: {
    art: choice(
      'Vorschrift',
      [
        { value: 'linear', label: '$x_{n+1} = a\\,x_n + b$' },
        { value: 'heron', label: 'Heron' },
      ],
      'linear',
    ),
    a: real('Faktor', { latex: 'a', min: -2, max: 10, step: 0.01, default: 0.8 }),
    b: real('Zuwachs', { latex: 'b', min: -100, max: 200, step: 1, default: 50 }),
    x0: real('Startwert', { latex: 'x_0', min: -10, max: 300, step: 0.1, default: 0 }),
    N: steps('Schritte', { latex: 'N', default: 20, max: 100 }),
  },
  start: (p) => p.x0,
  step: (x, p) => (p.art === 'heron' ? 0.5 * (x + 2 / x) : p.a * x + p.b),
  horizon: (p) => p.N,
})

const folgenApplet = (id: string, scenarios: { label: string; text?: string; params: Record<string, unknown> }[]) =>
  defineApplet({
    id,
    title: 'Konvergent oder divergent?',
    summary: 'vier Folgen aus der Vorlesung',
    chapter: 'Appendix',
    model: folgenModel,
    horizon: 'N',
    formulas: (p) => [
      p.art === 'heron'
        ? { label: 'Vorschrift', tex: String.raw`x_{n+1} = \frac12\left(x_n + \frac{2}{x_n}\right)` }
        : { label: 'Vorschrift', tex: String.raw`x_{n+1} = {{a}}{{*}}x_n {{+b}}` },
      { label: 'Start', tex: String.raw`x_0 = {{#x0}}` },
    ],
    // Heron in the slide's window; otherwise fitted, and refitted for each sequence (not held)
    plots: [{ type: 'timeSeriesDiscrete', series: ['x'], xLabel: 'n', yLabel: 'x_n', y: (p) => (p.art === 'heron' ? [0, 2.5] : 'auto'), logToggle: true, drag: { param: 'x0', axis: 'y' } }],
    layout: { main: ['art', 'a', 'b', 'x0'], visible: { a: (p) => p.art === 'linear', b: (p) => p.art === 'linear' } },
    scenarios,
  })

const SZ = {
  wechsel: { label: '(−1)ⁿ', text: 'x_{n+1} = −x_n mit x₀ = 1.', params: { art: 'linear', a: -1, b: 0, x0: 1, N: 10 } },
  heron: { label: 'Heron', text: 'x₀ = 0.5.', params: { art: 'heron', x0: 0.5, N: 8 } },
  medikament: { label: 'Medikament', text: 'x_{n+1} = 0.8 x_n + 50, x₀ = 0.', params: { art: 'linear', a: 0.8, b: 50, x0: 0, N: 20 } },
  malaria: { label: 'Malaria', text: 'x_{n+1} = 8 x_n, x₀ = 1.', params: { art: 'linear', a: 8, b: 0, x0: 1, N: 10 } },
}
const folgen6 = folgenApplet('va-folgen-6', [
  { ...SZ.wechsel, label: 'Folie 6: (−1)ⁿ' },
  { ...SZ.heron, label: 'Folie 6: Heron' },
])
const folgen7 = folgenApplet('va-folgen-7', [
  { ...SZ.medikament, label: 'Folie 7: Medikament' },
  { ...SZ.malaria, label: 'Folie 7: Malaria' },
])

// ------------------------------------------- Folien 13–16 und 19: Folgen in einer Funktion

interface Fn {
  label: string
  tex: string
  f: (x: number) => number
  /** The window of the slide. */
  x: readonly [number, number]
  y: readonly [number, number]
  /** A jump: the graph is cut there. */
  jump?: number
  /** A hole (an open circle) and the value at the jump (a dot). */
  hole?: readonly [number, number]
  dot?: readonly [number, number]
}

const FUNKTIONEN: Record<'glatt' | 'sprung' | 'vorzeichen' | 'quotient' | 'wurzel', Fn> = {
  glatt: { label: 'stetig', tex: String.raw`f(x) = 1.5 + 0.35\,(x-2) + 0.1\,(x-2)^3`, f: (x) => 1.5 + 0.35 * (x - 2) + 0.1 * (x - 2) ** 3, x: [0, 4], y: [0, 3.2] },
  sprung: {
    label: 'Sprung bei 2',
    tex: String.raw`f(x) = \begin{cases} 0.7, & x \le 2 \\ 2.5, & x > 2 \end{cases}`,
    f: (x) => (x <= 2 ? 0.7 : 2.5),
    x: [0, 4],
    y: [0, 3.2],
    jump: 2,
    hole: [2, 2.5],
    dot: [2, 0.7],
  },
  vorzeichen: {
    label: 'Sprung bei 0',
    tex: String.raw`f(x) = \begin{cases} 1, & x > 0 \\ -1, & x \le 0 \end{cases}`,
    f: (x) => (x > 0 ? 1 : -1),
    x: [-2, 2],
    y: [-1.5, 1.5],
    jump: 0,
    hole: [0, 1],
    dot: [0, -1],
  },
  wurzel: { label: '$\\sqrt{x}$', tex: String.raw`f(x) = \sqrt{x}`, f: (x) => (x < 0 ? NaN : Math.sqrt(x)), x: [0, 2], y: [0, 1.6] },
  quotient: { label: '$(x^2 - 1)/(x - 1)$', tex: String.raw`f(x) = \frac{x^2 - 1}{x - 1}, \quad x \ne 1`, f: (x) => (x === 1 ? NaN : (x * x - 1) / (x - 1)), x: [-0.5, 3], y: [0, 4], hole: [1, 2] },
}
type FnId = keyof typeof FUNKTIONEN

/** The graph over [lo, hi], cut at a jump. */
function graph(F: Fn, lo: number, hi: number): { x: Float64Array; y: Float64Array } {
  if (F.jump === undefined || F.jump <= lo || F.jump >= hi) return sample(F.f, lo, hi, 400)
  const left = sample(F.f, lo, F.jump, 200)
  // the right piece starts at the jump with the right-hand value
  const right = sample(F.f, F.jump, hi, 200)
  right.y[0] = F.f(F.jump + 1e-9)
  return { x: Float64Array.of(...left.x, NaN, ...right.x), y: Float64Array.of(...left.y, NaN, ...right.y) }
}

/** The point above a: (a, f(a)), or the hole where f is not defined. */
const above = (F: Fn, a: number): [number, number] | null => {
  const v = F.f(a)
  if (Number.isFinite(v)) return [a, v]
  return F.hole && F.hole[0] === a ? [a, F.hole[1]] : null
}

const SEITE = { links: 'von links', rechts: 'von rechts', beide: 'abwechselnd' } as const
const sign = (seite: keyof typeof SEITE, n: number) => (seite === 'rechts' ? 1 : seite === 'links' ? -1 : (-1) ** n)

const stetigModel = iteration({
  id: 'va-stetigkeit',
  params: {
    funktion: choice('Funktion', (Object.keys(FUNKTIONEN) as FnId[]).map((value) => ({ value, label: FUNKTIONEN[value].label })), 'glatt'),
    a: real('Stelle', { latex: 'a', min: -2, max: 4, step: 0.01, default: 2 }),
    folge: bool('Folge xₙ → a', { default: true, labelOn: 'an', labelOff: 'aus' }),
    seite: choice('Richtung', (Object.keys(SEITE) as (keyof typeof SEITE)[]).map((value) => ({ value, label: SEITE[value] })), 'links'),
    d: real('Abstand von x₁ zu a', { latex: 'd', min: 0.05, max: 2, step: 0.01, default: 1 }),
    N: steps('Folgenglieder', { latex: 'N', default: 12, max: 200 }),
  },
  // a stays in the slide's window
  normalize: (p) => {
    const [lo, hi] = FUNKTIONEN[p.funktion as FnId].x
    const a = Math.min(hi, Math.max(lo, p.a))
    return a === p.a ? p : { ...p, a }
  },
  // x_n = a ± d/n from n = 1 on: the timeline's n is the index (there is no x_0)
  start: () => NaN,
  step: (_x, p, k) => p.a + (sign(p.seite, k + 1) * p.d) / (k + 1),
  horizon: (p) => p.N,
  series: { id: 'folge', label: 'x_n' },
  extraSeries: ({ p, x, detail }) => {
    const F = FUNKTIONEN[p.funktion as FnId]
    const [lo, hi] = detail?.x ?? F.x
    const g = graph(F, Math.min(lo, F.x[0]), Math.max(hi, F.x[1]))
    const out: Series[] = [{ id: 'graph', label: 'f(x)', kind: 'continuous', x: g.x, y: g.y, role: 'primary' }]
    if (F.dot) out.push(points('punkt', 'f', [F.dot], 'primary', { legend: false }))
    // the point (a, f(a)) where f is defined
    if (Number.isFinite(F.f(p.a))) out.push(points('aPunkt', 'a', [[p.a, F.f(p.a)]], 'data', { legend: false }))
    if (F.hole) out.push(points('loch', 'f', [F.hole], 'primary', { legend: false, hollow: true }))
    if (p.folge) {
      // the terms on the x axis, their values on the y axis, and the points on the graph
      const fx = x.map(F.f)
      out.push(
        { id: 'xn', label: 'x_n', kind: 'discrete', x, y: x.map(() => F.y[0]), role: 'secondary', connect: false },
        { id: 'fxn', label: 'f(x_n)', kind: 'discrete', x: x.map(() => F.x[0]), y: fx, role: 'secondary', connect: false, legend: false },
        { id: 'punkte', label: 'f(x_n)', kind: 'discrete', x, y: fx, role: 'secondary', connect: false, legend: false },
      )
    }
    return out
  },
  observables: ({ p, x }) => {
    const F = FUNKTIONEN[p.funktion as FnId]
    const fa = F.f(p.a)
    const last = x[x.length - 1]
    return {
      fa: quantity('$f(a)$', Number.isFinite(fa) ? fa : null, { note: 'nicht definiert', digits: 4 }),
      fxN: quantity('$f(x_N)$', p.folge ? F.f(last) : null, { note: 'ohne Folge', digits: 4 }),
    }
  },
})

export const stetigApplet = (id: string, title: string, scenarios: { label: string; text?: string; params: Record<string, unknown> }[], timeline = true) =>
  defineApplet({
    id,
    title,
    summary: 'x_n → a, und f(x_n)?',
    chapter: 'Appendix',
    model: stetigModel,
    ...(timeline ? { horizon: 'N' } : { timeline: false }),
    formulas: (p) => [
      { label: 'Funktion', tex: FUNKTIONEN[p.funktion as FnId].tex },
      ...(p.folge ? [{ label: 'Folge', tex: String.raw`x_n = {{#a}} ${p.seite === 'rechts' ? '+' : p.seite === 'links' ? '-' : '+ (-1)^n'}\,\frac{${num(p.d)}}{n}` }] : []),
    ],
    plots: [
      {
        type: 'functionGraph',
        series: ['graph', 'punkt', 'loch', 'aPunkt', 'xn', 'fxn', 'punkte'],
        xLabel: 'x',
        yLabel: 'f(x)',
        x: (p) => [...FUNKTIONEN[p.funktion as FnId].x],
        y: (p) => [...FUNKTIONEN[p.funktion as FnId].y],
        // on the x axis: on the graph the handle would cover the dot or the hole at a jump
        drag: [{ param: 'a', axis: 'x', at: (p) => [p.a, FUNKTIONEN[p.funktion as FnId].y[0]], set: (x) => ({ a: Math.round(x * 100) / 100 }) }],
        // a and f(a) on the axes, and the term just reached with its value
        guides: (p: any, { step, run }: { step: number; run: Run }): readonly Guide[] => {
          const F = FUNKTIONEN[p.funktion as FnId]
          const [x0, y0] = [F.x[0], F.y[0]]
          const out: Guide[] = []
          const at = above(F, p.a)
          if (at) {
            out.push({ kind: 'drop', from: at, to: [at[0], y0], label: '' })
            out.push({ kind: 'drop', from: at, to: [x0, at[1]], label: Number.isFinite(F.f(p.a)) ? 'f(a)' : `L = ${num(at[1])}` })
          }
          const xs = run.series.find((s) => s.id === 'folge')?.y
          if (p.folge && xs) {
            const k = Math.min(step, xs.length - 1)
            const v = F.f(xs[k])
            if (Number.isFinite(v)) {
              out.push({ kind: 'drop', from: [xs[k], v], to: [xs[k], y0], label: `x_{${k}}` })
              out.push({ kind: 'drop', from: [xs[k], v], to: [x0, v], label: `f(x_{${k}})` })
            }
          }
          return out
        },
      },
    ],
    layout: { main: ['funktion', 'a', 'folge', 'seite', 'd'], visible: { seite: (p) => p.folge, d: (p) => p.folge, N: (p) => p.folge } },
    readouts: ['fa', 'fxN'],
    scenarios,
  })

const stetig = stetigApplet(
  'va-stetig',
  'Stetigkeit: die Idee',
  [
    { label: 'Folie 13: stetig', text: 'Kein Sprung bei a.', params: { funktion: 'glatt', a: 2, folge: false } },
    { label: 'Folie 13: unstetig', text: 'Bei a = 2 springt der Graph.', params: { funktion: 'sprung', a: 2, folge: false } },
    { label: 'an einer anderen Stelle', text: 'Bei a = 3 ist dieselbe Funktion stetig.', params: { funktion: 'sprung', a: 3, folge: false } },
  ],
  false,
)

const stetigFolge = stetigApplet('va-stetig-folge', 'Stetigkeit: Definition', [
  { label: 'Folie 14', text: 'x_n → a von links, und f(x_n) → f(a).', params: { funktion: 'glatt', a: 3, folge: true, seite: 'links', d: 1, N: 12 } },
  { label: 'abwechselnd', params: { funktion: 'glatt', a: 3, folge: true, seite: 'beide', d: 1, N: 12 } },
  { label: 'mit Sprung', text: 'Von rechts: f(x_n) = 2.5, aber f(2) = 0.7.', params: { funktion: 'sprung', a: 2, folge: true, seite: 'rechts', d: 1, N: 12 } },
])

const unstetig = stetigApplet('va-unstetig', 'Beispiel: eine unstetige Funktion', [
  { label: 'Folie 16', text: 'x_n = 1/n → 0, f(x_n) = 1, aber f(0) = −1.', params: { funktion: 'vorzeichen', a: 0, folge: true, seite: 'rechts', d: 1, N: 10 } },
  { label: 'von links', text: 'Von links ist f(x_n) = −1 = f(0).', params: { funktion: 'vorzeichen', a: 0, folge: true, seite: 'links', d: 1, N: 10 } },
  { label: 'abwechselnd', text: 'f(x_n) springt zwischen 1 und −1.', params: { funktion: 'vorzeichen', a: 0, folge: true, seite: 'beide', d: 1, N: 10 } },
])

const grenzwertA = stetigApplet('va-grenzwert-a', 'Grenzwert einer Funktion für x → a', [
  { label: 'Folie 19', text: 'f ist bei 1 nicht definiert, aber f(x_n) → 2.', params: { funktion: 'quotient', a: 1, folge: true, seite: 'rechts', d: 1, N: 12 } },
  { label: 'von links', params: { funktion: 'quotient', a: 1, folge: true, seite: 'links', d: 1, N: 12 } },
  { label: 'abwechselnd', params: { funktion: 'quotient', a: 1, folge: true, seite: 'beide', d: 1, N: 12 } },
])

// ------------------------------------------------------------- Folie 18: Heron-Verfahren

const heronV = defineApplet({
  ...heron,
  id: 'va-heron',
  title: 'Beispiel: Heron-Verfahren',
  summary: 'x_{n+1} = ½ (x_n + 2/x_n)',
  chapter: 'Appendix',
  // the sequence as on the slide, and beside it the cobweb: a limit lies where f meets the diagonal
  plots: [
    { type: 'timeSeriesDiscrete', series: ['x'], xLabel: 'n', yLabel: 'x_n', y: [0, 2.5], drag: { param: 'x0', axis: 'y' } },
    { ...heron.plots[0], x: [0, 3], y: [0, 3] },
  ],
  readouts: ['grenzwert'],
  scenarios: [
    { label: 'Folie 18', text: 'x₀ = 0.5.', params: { x0: 0.5, N: 8 } },
    { label: 'x₀ = 2.8', params: { x0: 2.8, N: 8 } },
  ],
})

// ----------------------------------------------------------- Folie 20: Grenzwert für x → ∞

const unendlich = defineApplet({
  id: 'va-grenzwert-unendlich',
  title: 'Grenzwert einer Funktion für x → ∞',
  summary: 'f(x) = 2x/(5 + x) → 2',
  chapter: 'Appendix',
  model: closedForm({
    id: 'va-grenzwert-unendlich',
    params: {
      c: real('Konstante im Nenner', { latex: 'c', min: 0.5, max: 50, step: 0.5, default: 5 }),
      X: real('Fenster bis', { latex: 'X', min: 10, max: 100000, step: 1, default: 60, scale: 'log' }),
    },
    domain: (p) => [0, p.X],
    samples: 600,
    curves: { f: { label: 'f(x)', f: (x, p) => (2 * x) / (p.c + x) } },
    extraSeries: ({ p }) => [segment('L', 'L = 2', [0, 2], [p.X, 2], 'reference', { name: 'Grenzwert' })],
    observables: ({ p }) => {
      const v = (2 * p.X) / (p.c + p.X)
      return {
        fX: quantity('$f(X)$', v, { digits: 6, marks: [{ kind: 'point', x: p.X, y: v, in: 'map' }] }),
        abstand: quantity('$2 - f(X)$', 2 - v, { digits: 3 }),
      }
    },
  }),
  formulas: [
    { label: 'Funktion', tex: String.raw`f(x) = \frac{2x}{{{c}} + x}` },
    { label: 'Grenzwert', tex: String.raw`\lim_{x \to \infty} f(x) = 2` },
  ],
  plots: [
    {
      type: 'functionGraph',
      series: ['f', 'L'],
      xLabel: 'x',
      yLabel: 'f(x)',
      x: (p) => [0, p.X],
      y: [0, 2.3],
      drag: [{ param: 'X', axis: 'x', at: (p) => [p.X, (2 * p.X) / (p.c + p.X)], set: (x) => ({ X: Math.max(10, x) }) }],
    },
  ],
  readouts: ['fX', 'abstand'],
  scenarios: [
    { label: 'Folie 20', text: 'x bis 60.', params: { c: 5, X: 60 } },
    { label: 'bis 1000', params: { c: 5, X: 1000 } },
    { label: 'bis 100 000', params: { c: 5, X: 100000 } },
  ],
})

// ---------------------------------------------- Folien 22–30: Differenzenquotient, Ableitung

interface Df {
  label: string
  tex: string
  /** f′(x) as TeX. */
  dtex: string
  f: (x: number) => number
  df: (x: number) => number
  /** Where f is drawn, and the slide's window. */
  domain: readonly [number, number]
  x: readonly [number, number]
  y: readonly [number, number]
  /** The window of f′ over x. */
  dy: readonly [number, number]
}

const ABLEITUNGEN: Record<'x3x2' | 'x2' | 'sqrt' | 'inv' | 'logistisch', Df> = {
  x3x2: { label: '$x^3 + x^2$', tex: 'x^3 + x^2', dtex: '3x^2 + 2x', f: (x) => x ** 3 + x * x, df: (x) => 3 * x * x + 2 * x, domain: [-1.5, 2.5], x: [-0.3, 2.3], y: [-3, 16], dy: [-1, 21] },
  x2: { label: '$x^2$', tex: 'x^2', dtex: '2x', f: (x) => x * x, df: (x) => 2 * x, domain: [-3, 3], x: [-2.5, 2.5], y: [-1, 6.5], dy: [-5.5, 5.5] },
  sqrt: { label: '$\\sqrt{x}$', tex: '\\sqrt{x}', dtex: '\\frac{1}{2\\sqrt{x}}', f: Math.sqrt, df: (x) => 0.5 / Math.sqrt(x), domain: [0, 4.5], x: [0, 4], y: [0, 2.5], dy: [0, 3] },
  inv: { label: '$\\frac{1}{x}$', tex: '\\frac{1}{x}', dtex: '-\\frac{1}{x^2}', f: (x) => 1 / x, df: (x) => -1 / (x * x), domain: [0.12, 4.5], x: [0, 4], y: [0, 5], dy: [-10, 0.5] },
  logistisch: {
    label: 'logistisch, $r = 0.5$, $K = 5$',
    tex: '1.5\\,x - 0.1\\,x^2',
    dtex: '1.5 - 0.2\\,x',
    f: (x) => 1.5 * x - 0.1 * x * x,
    df: (x) => 1.5 - 0.2 * x,
    domain: [0, 16],
    x: [0, 15],
    y: [0, 6.5],
    dy: [-1.7, 1.7],
  },
}
type DfId = keyof typeof ABLEITUNGEN
const H_MAX = 1

/** a and a + h inside where f is drawn (√x: a > 0). */
const clampD = (F: Df, v: number) => Math.min(F.domain[1], Math.max(F.domain[0] === 0 ? 0.01 : F.domain[0], v))
const quotient = (F: Df, a: number, h: number) => (F.f(a + h) - F.f(a)) / h
const lineThrough = (x0: number, y0: number, m: number, [lo, hi]: readonly [number, number]) => ({ x: Float64Array.of(lo, hi), y: Float64Array.of(y0 + m * (lo - x0), y0 + m * (hi - x0)) })

const ableitungModel = closedForm({
  id: 'va-ableitung',
  params: {
    f: choice('Funktion', (Object.keys(ABLEITUNGEN) as DfId[]).map((value) => ({ value, label: ABLEITUNGEN[value].label })), 'x3x2'),
    a: real('Stelle', { latex: 'a', min: -2, max: 15, step: 0.01, default: 1 }),
    h: real('Schrittweite', { latex: 'h', min: -H_MAX, max: H_MAX, step: 0.01, default: 1 }),
    sekanten: bool('Sekanten zu h = 1, ½, ¼', { default: false, labelOn: 'an', labelOff: 'aus' }),
    tangente: bool('Tangente', { default: false, labelOn: 'an', labelOff: 'aus' }),
  },
  normalize: (p) => {
    const F = ABLEITUNGEN[p.f as DfId]
    const a = clampD(F, p.a)
    const h = clampD(F, a + p.h) === a + p.h ? p.h : clampD(F, a + p.h) - a
    return a === p.a && h === p.h ? p : { ...p, a, h }
  },
  constraintNote: 'a und a + h liegen im Definitionsbereich von f',
  domain: (p) => ABLEITUNGEN[p.f as DfId].domain,
  samples: 500,
  curves: { f: { label: 'f', f: (x, p) => ABLEITUNGEN[p.f as DfId].f(x) } },
  extraSeries: ({ p }) => {
    const F = ABLEITUNGEN[p.f as DfId]
    const [fa, dfa] = [F.f(p.a), F.df(p.a)]
    const out: Series[] = []
    if (p.sekanten)
      for (const h of [1, 0.5, 0.25])
        if (F.domain[1] >= p.a + h) out.push({ id: `fam${h}`, label: 's', kind: 'continuous', ...lineThrough(p.a, fa, quotient(F, p.a, h), F.domain), role: 'ghost', legend: false })
    if (p.h !== 0) out.push({ id: 'sekante', label: 's(x)', name: 'Sekante', kind: 'continuous', ...lineThrough(p.a, fa, quotient(F, p.a, p.h), F.domain), role: 'secondary' })
    if (p.tangente) out.push({ id: 'tangente', label: 't(x)', name: 'Tangente', kind: 'continuous', ...lineThrough(p.a, fa, dfa, F.domain), role: 'tertiary' })
    out.push(points('aPunkt', 'a', [[p.a, fa]], 'data', { legend: false }))
    // the difference quotient as a function of h: a curve with a hole at h = 0
    const g = sample((h) => (Math.abs(h) < 1e-9 || p.a + h < F.domain[0] || p.a + h > F.domain[1] ? NaN : quotient(F, p.a, h)), -H_MAX, H_MAX, 401)
    out.push(
      { id: 'g', label: 'g(h)', kind: 'continuous', x: g.x, y: g.y, role: 'primary' },
      segment('grenze', "f'(a)", [-H_MAX, dfa], [H_MAX, dfa], 'reference', { name: 'Grenzwert' }),
      points('loch', 'g', [[0, dfa]], 'primary', { legend: false, hollow: true }),
      ...(p.h !== 0 ? [points('gPunkt', 'g(h)', [[p.h, quotient(F, p.a, p.h)]], 'secondary', { legend: false })] : []),
    )
    // the derivative as a function
    const d = sample((x) => (x <= 0 && p.f === 'sqrt' ? NaN : F.df(x)), F.domain[0], F.domain[1], 400)
    out.push({ id: 'fstrich', label: "f'", kind: 'continuous', x: d.x, y: d.y, role: 'secondary', dash: [] }, points('fstrichPunkt', "f'(a)", [[p.a, dfa]], 'secondary', { legend: false }))
    return out
  },
  observables: ({ p }) => {
    const F = ABLEITUNGEN[p.f as DfId]
    const d = p.h === 0 ? null : quotient(F, p.a, p.h)
    return {
      quotient: quantity('Differenzenquotient $g(h)$', d, { note: 'bei h = 0 nicht definiert', digits: 4, marks: d === null ? [] : [{ kind: 'point', x: p.h, y: d, in: 'map' }] }),
      ableitung: quantity("Ableitung $f'(a)$", F.df(p.a), { digits: 4, marks: [{ kind: 'line', x: p.a, y: F.f(p.a), slope: F.df(p.a), in: 'map' }] }),
    }
  },
})

const fOf = (p: any) => ABLEITUNGEN[p.f as DfId]
export const graphPlot = (series: readonly string[], extra: { guides?: boolean } = {}) => ({
  type: 'functionGraph' as const,
  series,
  xLabel: 'x',
  yLabel: 'f(x)',
  x: (p: any) => [...fOf(p).x] as [number, number],
  y: (p: any) => [...fOf(p).y] as [number, number],
  drag: [
    { param: 'a', axis: 'x' as const, at: (p: any): [number, number] => [p.a, fOf(p).f(p.a)], set: (x: number) => ({ a: x }) },
    { param: 'h', axis: 'x' as const, label: 'a + h', at: (p: any): [number, number] | null => (p.h === 0 ? null : [p.a + p.h, fOf(p).f(p.a + p.h)]), set: (x: number, _y: number, p: any) => ({ h: Math.max(-H_MAX, Math.min(H_MAX, x - p.a)) }) },
  ],
  // the slope triangle of the secant: run h, rise f(a + h) − f(a)
  ...(extra.guides
    ? {
        guides: (p: any): readonly Guide[] => {
          const F = fOf(p)
          if (p.h === 0) return []
          const [A, B]: [number, number][] = [
            [p.a, F.f(p.a)],
            [p.a + p.h, F.f(p.a + p.h)],
          ]
          return [{ kind: 'rise', from: A, to: B, label: num(B[1] - A[1]), run: `h = ${num(p.h)}` }]
        },
      }
    : {}),
})
const quotientPlot = {
  type: 'functionGraph' as const,
  series: ['g', 'grenze', 'loch', 'gPunkt'],
  xLabel: 'h',
  yLabel: 'g(h)',
  x: [-H_MAX, H_MAX] as [number, number],
  // fitted to g on [−1, 1] for each function (not held from the one before)
  y: (p: any): [number, number] => {
    const F = fOf(p)
    let [lo, hi] = [F.df(p.a), F.df(p.a)]
    for (let h = -H_MAX; h <= H_MAX; h += 0.01) {
      const v = Math.abs(h) < 1e-9 || p.a + h < F.domain[0] || p.a + h > F.domain[1] ? NaN : quotient(F, p.a, h)
      if (Number.isFinite(v)) [lo, hi] = [Math.min(lo, v), Math.max(hi, v)]
    }
    const pad = 0.06 * (hi - lo || 1)
    return [lo - pad, hi + pad]
  },
  drag: [{ param: 'h', axis: 'x' as const, at: (p: any): [number, number] | null => (p.h === 0 ? null : [p.h, quotient(fOf(p), p.a, p.h)]), set: (x: number) => ({ h: x }) }],
}

export const ableitungApplet = (id: string, title: string, summary: string, plots: readonly any[], formulas: (p: any) => { label: string; tex: string }[], scenarios: { label: string; text?: string; params: Record<string, unknown> }[], readouts = ['quotient', 'ableitung'], shown = ['f', 'a', 'h', 'sekanten', 'tangente']) =>
  defineApplet({
    id,
    title,
    summary,
    chapter: 'Appendix',
    model: ableitungModel,
    formulas,
    plots,
    // only the switches this slide needs; the others keep the scenario's values
    layout: { main: shown, visible: Object.fromEntries(['h', 'sekanten', 'tangente'].filter((id) => !shown.includes(id)).map((id) => [id, () => false])) },
    readouts,
    scenarios,
  })

export const fFormula = { label: 'Funktion', tex: String.raw`f(x) = {{f}}` }
export const quotientFormula = { label: 'Differenzenquotient', tex: String.raw`g(h) = \frac{f({{a}} + {{h}}) - f({{a}})}{{{h}}}` }
export const tangentFormula = (p: any) => {
  const F = fOf(p)
  return { label: 'Tangente', tex: String.raw`t(x) = f(a) + f'(a)\,(x - a) = ${num(F.f(p.a))} ${F.df(p.a) < 0 ? '-' : '+'} ${num(Math.abs(F.df(p.a)))}\,(x - ${num(p.a)})` }
}
const X3X2 = { f: 'x3x2', a: 1 }

const sekante = ableitungApplet('va-sekante', 'Differenzenquotient', 'Sekante durch (a, f(a)) und (a + h, f(a + h))', [graphPlot(['f', 'sekante', 'aPunkt'], { guides: true })], () => [fFormula, quotientFormula], [
  { label: 'Folie 22', text: 'f(x) = x³ + x², a = 1, h = 1: die Sekante durch (1, 2) und (2, 12).', params: { ...X3X2, h: 1, sekanten: false, tangente: false } },
  { label: 'h = 0.5', params: { ...X3X2, h: 0.5, sekanten: false, tangente: false } },
  { label: 'h = 0.1', params: { ...X3X2, h: 0.1, sekanten: false, tangente: false } },
], undefined, ['f', 'a', 'h'])

const quotientApplet = ableitungApplet('va-quotient', 'Differenzenquotient als Funktion von h', 'g(h) hat bei h = 0 ein Loch', [quotientPlot, graphPlot(['f', 'sekante', 'aPunkt'])], () => [fFormula, quotientFormula], [
  { label: 'Folie 23', text: 'g(h) für h zwischen −1 und 1, bei h = 0 nicht definiert.', params: { ...X3X2, h: 1, sekanten: false, tangente: false } },
  { label: 'h = 0.1', params: { ...X3X2, h: 0.1, sekanten: false, tangente: false } },
  { label: 'h = −0.5', params: { ...X3X2, h: -0.5, sekanten: false, tangente: false } },
], undefined, ['f', 'a', 'h'])

const tangente = ableitungApplet('va-tangente', 'Ableitung und Tangente', "t(x) = f(a) + f'(a)(x − a)", [graphPlot(['f', 'fam1', 'fam0.5', 'fam0.25', 'sekante', 'tangente', 'aPunkt'])], (p) => [fFormula, quotientFormula, tangentFormula(p)], [
  { label: 'Folie 24', text: 'Die Sekanten nähern sich der Tangente.', params: { ...X3X2, h: 1, sekanten: true, tangente: true } },
  { label: 'Folie 25', text: 't(x) = 5x − 3.', params: { ...X3X2, h: 0, sekanten: false, tangente: true } },
  { label: 'Folie 27: x²', text: "f'(a) = 2a.", params: { f: 'x2', a: 1, h: 0.5, sekanten: false, tangente: true } },
  { label: 'Folie 28: √x', text: "f'(a) = 1/(2√a).", params: { f: 'sqrt', a: 1, h: 0.5, sekanten: false, tangente: true } },
  { label: 'Folie 29: 1/x', text: "f'(a) = −1/a².", params: { f: 'inv', a: 1, h: 0.5, sekanten: false, tangente: true } },
])

const ableitungsfunktion = ableitungApplet(
  'va-ableitungsfunktion',
  'Ableitungsfunktion',
  "f'(x) als Funktion",
  [
    graphPlot(['f', 'tangente', 'aPunkt']),
    {
      type: 'functionGraph' as const,
      series: ['fstrich', 'fstrichPunkt'],
      xLabel: 'x',
      yLabel: "f'(x)",
      x: (p: any) => [...fOf(p).x] as [number, number],
      y: (p: any) => [...fOf(p).dy] as [number, number],
      drag: [{ param: 'a', axis: 'x' as const, at: (p: any): [number, number] => [p.a, fOf(p).df(p.a)], set: (x: number) => ({ a: x }) }],
    },
  ],
  (p) => [fFormula, { label: 'Ableitung', tex: String.raw`f'(x) = ${fOf(p).dtex}` }, tangentFormula(p)],
  [
    { label: 'Folie 30', text: "f(x) = x³ + x², f'(x) = 3x² + 2x.", params: { ...X3X2, h: 0, sekanten: false, tangente: true } },
    { label: 'logistisch', text: "f'(x) = 1 + r − 2r/K x mit r = 0.5, K = 5.", params: { f: 'logistisch', a: 5, h: 0, sekanten: false, tangente: true } },
    { label: 'x²', params: { f: 'x2', a: 1, h: 0, sekanten: false, tangente: true } },
    { label: '√x', params: { f: 'sqrt', a: 1, h: 0, sekanten: false, tangente: true } },
    { label: '1/x', params: { f: 'inv', a: 1, h: 0, sekanten: false, tangente: true } },
  ],
  ['ableitung'],
  ['f', 'a'],
)

// ------------------------------------------------------------ Folie 26: Blick durch die Lupe

/** Half the window's width; its height follows the tangent's slope, so t runs corner to corner. */
const halb = (p: { zoom: number }) => 1 / p.zoom
const hoch = (F: Df, a: number) => Math.max(0.5, Math.abs(F.df(a)))

export const lupe = defineApplet({
  id: 'va-lupe',
  title: 'Blick durch die Lupe',
  summary: 'Nahe bei a sieht f aus wie seine Tangente',
  chapter: 'Appendix',
  model: closedForm({
    id: 'va-lupe',
    params: {
      f: choice('Funktion', (Object.keys(ABLEITUNGEN) as DfId[]).map((value) => ({ value, label: ABLEITUNGEN[value].label })), 'x3x2'),
      a: real('Stelle', { latex: 'a', min: -2, max: 15, step: 0.01, default: 1 }),
      zoom: real('Vergrößerung', { latex: 'z', min: 1, max: 1000, step: 0.1, default: 1, scale: 'log', limits: { min: 1, max: 1e6, reason: 'Vergrößerung zwischen 1 und einer Million.' } }),
    },
    normalize: (p) => {
      const a = clampD(ABLEITUNGEN[p.f as DfId], p.a)
      return a === p.a ? p : { ...p, a }
    },
    domain: (p) => [p.a - halb(p), p.a + halb(p)],
    samples: 400,
    curves: {
      f: { label: 'f', f: (x, p) => ABLEITUNGEN[p.f as DfId].f(x) },
      t: { label: 't', name: 'Tangente', role: 'tertiary', f: (x, p) => ABLEITUNGEN[p.f as DfId].f(p.a) + ABLEITUNGEN[p.f as DfId].df(p.a) * (x - p.a) },
    },
    extraSeries: ({ p }) => [points('aPunkt', 'a', [[p.a, ABLEITUNGEN[p.f as DfId].f(p.a)]], 'data', { legend: false })],
    observables: ({ p }) => {
      const F = ABLEITUNGEN[p.f as DfId]
      const w = halb(p)
      const dev = sample((x) => Math.abs(F.f(x) - F.f(p.a) - F.df(p.a) * (x - p.a)), p.a - w, p.a + w, 201)
      let m = 0
      for (const v of dev.y) if (Number.isFinite(v)) m = Math.max(m, v)
      return { abstand: quantity('größter Abstand zur Tangente', m, { digits: 3 }) }
    },
  }),
  formulas: (p) => [fFormula, tangentFormula(p), { label: 'Ausschnitt', tex: String.raw`|x - {{a}}| \le \frac{1}{{{zoom}}}` }],
  plots: [
    {
      type: 'functionGraph',
      series: ['f', 't', 'aPunkt'],
      xLabel: 'x',
      yLabel: 'y',
      x: (p) => [p.a - halb(p), p.a + halb(p)],
      y: (p) => {
        const F = ABLEITUNGEN[p.f as DfId]
        const v = F.f(p.a)
        return [v - hoch(F, p.a) * halb(p), v + hoch(F, p.a) * halb(p)]
      },
    },
  ],
  readouts: ['abstand'],
  scenarios: [
    { label: 'Folie 26: um a = 1', text: 'f(x) = x³ + x², Tangente t(x) = 5x − 3.', params: { f: 'x3x2', a: 1, zoom: 1 } },
    { label: 'Lupe ×4', params: { f: 'x3x2', a: 1, zoom: 4 } },
    { label: 'Lupe ×20', params: { f: 'x3x2', a: 1, zoom: 20 } },
    { label: 'Lupe ×200', params: { f: 'x3x2', a: 1, zoom: 200 } },
  ],
})

export const anhangA: AppletModule<any>[] = [
  grenzwert,
  einsDurchN,
  folgen6,
  folgen7,
  stetig,
  stetigFolge,
  unstetig,
  heronV,
  grenzwertA,
  unendlich,
  sekante,
  quotientApplet,
  tangente,
  lupe,
  ableitungsfunktion,
]
