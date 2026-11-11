// Vorlesung, Kapitel 1 ab dem Rückblick (stationäre Zustände, Spinnwebdiagramme, Stabilität,
// Newton-Verfahren): one applet per visualisation of the slides, fully interactive, with the
// slides' parameters as scenarios. For the beamer; registered in ../index.ts, not in the
// gallery. Slides that show the same picture with other numbers share a model; each tab opens
// in its slide's first scenario.

import { bisect, bool, category, choice, closedForm, index, int, iteration, list, quantity, real, sample, steps, type Run, type Series } from '@abacus/applet-core'
import { defineApplet, type AppletModule, type Guide } from '@abacus/applet-ui/define'
import newton from '../newton'
import { bifurcation } from '../logistic-bifurcation'
import { ableitungApplet, fFormula, graphPlot, lupe, quotientFormula, stetigApplet, tangentFormula } from './anhang-a'

type Scenarios = { label: string; text?: string; params: Record<string, unknown> }[]

/** A number for a label: at most three decimals; "≈" when that rounds. */
const approx = (v: number, d = 3) => {
  const r = +v.toFixed(d)
  return `${Math.abs(r - v) > 1e-12 ? '\\approx' : '='} ${r}`
}
const iterate = (x0: number, f: (x: number) => number, N: number) => {
  const y = new Float64Array(N + 1)
  y[0] = x0
  for (let k = 0; k < N; k++) y[k + 1] = f(y[k])
  return y
}
const seq = (id: string, label: string, y: Float64Array, role: Series['role'], extra: Partial<Series> = {}): Series => ({
  id,
  label,
  kind: 'discrete',
  x: Float64Array.from(y, (_, k) => k),
  y,
  role,
  ...extra,
})
const segment = (id: string, label: string, [x0, y0]: readonly [number, number], [x1, y1]: readonly [number, number], role: Series['role'], extra: Partial<Series> = {}): Series => ({
  id,
  label,
  kind: 'continuous',
  x: Float64Array.of(x0, x1),
  y: Float64Array.of(y0, y1),
  role,
  ...extra,
})
const points = (id: string, label: string, pts: readonly (readonly [number, number])[], role: Series['role'], extra: Partial<Series> = {}): Series => ({
  id,
  label,
  kind: 'discrete',
  x: Float64Array.from(pts.length ? pts.map((q) => q[0]) : [NaN]),
  y: Float64Array.from(pts.length ? pts.map((q) => q[1]) : [NaN]),
  role,
  connect: false,
  ...extra,
})
const logistic = (a: number) => (y: number) => a * y * (1 - y)

// ---------------------------------------------------------- Rückblick und Konvergenz

const rueckblick = defineApplet({
  id: 'vs-rueckblick',
  title: 'Rückblick und Konvergenz',
  summary: 'y_{n+1} = a y_n (1 − y_n) für a = 2.8 und a = 3.2',
  chapter: 'I',
  model: iteration({
    id: 'vs-rueckblick',
    params: {
      a1: real('Wachstumsrate (links)', { latex: 'a_1', min: 0, max: 4, step: 0.01, default: 2.8 }),
      a2: real('Wachstumsrate (rechts)', { latex: 'a_2', min: 0, max: 4, step: 0.01, default: 3.2 }),
      y0: real('Startwert', { latex: 'y_0', min: 0, max: 1, step: 0.01, default: 0.1 }),
      band: bool('Band um y*', { default: false, labelOn: 'an', labelOff: 'aus' }),
      eps: real('Breite des Bandes', { latex: '\\varepsilon', min: 0.005, max: 0.3, step: 0.005, default: 0.05 }),
      N: steps('Schritte', { latex: 'N', default: 40, max: 200 }),
    },
    start: (p) => p.y0,
    step: (y, p) => p.a1 * y * (1 - y),
    horizon: (p) => p.N,
    series: { id: 'y', label: 'y_n' },
    extraSeries: ({ p }) => {
      const out: Series[] = []
      for (const [i, a] of [p.a1, p.a2].entries()) {
        const k = i + 1
        const s = a > 0 ? 1 - 1 / a : NaN
        if (p.band && s > 0) {
          out.push(
            { id: `band${k}`, label: 'y^* \\pm \\varepsilon', name: 'Band', kind: 'continuous', x: Float64Array.of(0, p.N, p.N, 0), y: Float64Array.of(s - p.eps, s - p.eps, s + p.eps, s + p.eps), role: 'ghost', fill: true },
            segment(`fix${k}`, `y^* ${approx(s)}`, [0, s], [p.N, s], 'reference'),
          )
        }
        out.push(seq(`s${k}`, `a = ${+a.toFixed(4)}`, iterate(p.y0, logistic(a), p.N), 'primary'))
      }
      return out
    },
  }),
  horizon: 'N',
  formulas: [
    { label: 'Vorschrift', tex: String.raw`y_{n+1} = a\,y_n\,(1 - y_n), \quad a = {{#a1}} \text{ und } {{#a2}}` },
    { label: 'Start', tex: String.raw`y_0 = {{#y0}}` },
  ],
  plots: [
    { type: 'timeSeriesDiscrete', series: ['band1', 'fix1', 's1'], xLabel: 'n', yLabel: 'y_n', y: [0, 1], drag: { param: 'y0', axis: 'y' } },
    { type: 'timeSeriesDiscrete', series: ['band2', 'fix2', 's2'], xLabel: 'n', yLabel: 'y_n', y: [0, 1], drag: { param: 'y0', axis: 'y' } },
  ],
  layout: { main: ['a1', 'a2', 'y0', 'band', 'eps'], visible: { eps: (p) => p.band } },
  scenarios: [
    { label: 'Rückblick', text: 'Links pendelt sich die Folge ein, rechts springt sie zwischen zwei Werten.', params: { a1: 2.8, a2: 3.2, y0: 0.1, band: false, N: 40 } },
    { label: 'Konvergenz: Band', text: 'Ein Band der Breite ε um y* = 1 − 1/a: links bleibt die Folge ab einem N darin, rechts nicht.', params: { a1: 2.8, a2: 3.2, y0: 0.1, band: true, eps: 0.05, N: 40 } },
  ],
})

// ------------------------------------------------------------ Wiederholung aus Anhang A

const stetigkeit = stetigApplet('vs-stetigkeit', 'Wiederholung: Stetigkeit', [
  { label: 'stetig', text: 'f(x) = √x: aus x_n → a folgt f(x_n) → f(a).', params: { funktion: 'wurzel', a: 1, folge: true, seite: 'rechts', d: 1, N: 10 } },
  { label: 'unstetig', text: 'Von rechts ist f(x_n) = 1, aber f(0) = −1.', params: { funktion: 'vorzeichen', a: 0, folge: true, seite: 'rechts', d: 1, N: 10 } },
])

const ableitung = ableitungApplet(
  'vs-ableitung',
  'Wiederholung: Ableitung',
  'Für h → 0 wird aus der Sekante die Tangente',
  [graphPlot(['f', 'fam1', 'fam0.5', 'fam0.25', 'sekante', 'tangente', 'aPunkt'])],
  (p) => [fFormula, quotientFormula, tangentFormula(p)],
  [
    { label: 'Wiederholung', text: 'f(x) = √x: die Sekanten nähern sich der Tangente.', params: { f: 'sqrt', a: 0.5, h: 1, sekanten: true, tangente: true } },
    { label: 'h = 0.1', params: { f: 'sqrt', a: 0.5, h: 0.1, sekanten: false, tangente: true } },
  ],
)

const tangente = defineApplet({
  ...lupe,
  id: 'vs-tangente',
  title: 'Wiederholung: Tangente',
  summary: 'Unter der Lupe sieht √x aus wie seine Tangente',
  scenarios: [
    { label: 'Überblick', text: 'f(x) = √x, a = 1, t(x) = 1 + ½ (x − 1).', params: { f: 'sqrt', a: 1, zoom: 1 } },
    { label: 'Lupe', text: 'x zwischen 0.9 und 1.1.', params: { f: 'sqrt', a: 1, zoom: 10 } },
    { label: 'Lupe ×100', params: { f: 'sqrt', a: 1, zoom: 100 } },
  ],
})

// --------------------------------------------------------- Folien 36–40: stationäre Zustände

/** The update functions of the slides: logistic, linear, square root, the epidemic. */
const ARTEN = {
  logistisch: { label: '$a\\,x\\,(1 - x)$' },
  linear: { label: '$a\\,x + b$' },
  wurzel: { label: '$\\sqrt{x}$' },
  epidemie: { label: '$1 - e^{-a x}$' },
} as const
type Art = keyof typeof ARTEN
type FP = { art: Art; a: number; b: number }

const f = (p: FP) => (x: number): number => {
  switch (p.art) {
    case 'logistisch':
      return p.a * x * (1 - x)
    case 'linear':
      return p.a * x + p.b
    case 'wurzel':
      return x < 0 ? NaN : Math.sqrt(x)
    case 'epidemie':
      return 1 - Math.exp(-p.a * x)
  }
}
const df = (p: FP) => (x: number): number => {
  switch (p.art) {
    case 'logistisch':
      return p.a - 2 * p.a * x
    case 'linear':
      return p.a
    case 'wurzel':
      return x <= 0 ? Infinity : 0.5 / Math.sqrt(x)
    case 'epidemie':
      return p.a * Math.exp(-p.a * x)
  }
}
/** The stationary states x = f(x), from the formulas of the slides. `alle`: every x (x = x). */
function fixpunkte(p: FP): { xs: number[]; alle?: boolean } {
  switch (p.art) {
    case 'logistisch':
      return { xs: p.a === 0 || p.a === 1 ? [0] : [0, 1 - 1 / p.a] }
    case 'linear':
      if (p.a === 1) return p.b === 0 ? { xs: [], alle: true } : { xs: [] }
      return { xs: [p.b / (1 - p.a)] }
    case 'wurzel':
      return { xs: [0, 1] }
    case 'epidemie': {
      // besides 0 a second state for a > 1: where 1 − e^{−ax} meets the diagonal
      if (p.a <= 1) return { xs: [0] }
      const g = (x: number) => 1 - Math.exp(-p.a * x) - x
      return { xs: [0, bisect(g, 1e-9, 1)] }
    }
  }
}
const vorschrift = (p: FP, v = 'x') =>
  p.art === 'logistisch'
    ? String.raw`${v}_{n+1} = {{a}}{{*}}${v}_n\,(1 - ${v}_n)`
    : p.art === 'linear'
      ? String.raw`${v}_{n+1} = {{a}}{{*}}${v}_n {{+b}}`
      : p.art === 'wurzel'
        ? String.raw`${v}_{n+1} = \sqrt{${v}_n}`
        : String.raw`${v}_{n+1} = 1 - e^{-{{a}}\,${v}_n}`
const fixLabel = (p: FP, i: number, n: number) => (n > 1 ? `x_{${'ab'[i]}}^*` : 'x^*')

const artParams = {
  art: choice('Aktualisierungsfunktion', (Object.keys(ARTEN) as Art[]).map((value) => ({ value, label: ARTEN[value].label })), 'logistisch'),
  a: real('Parameter', { latex: 'a', min: -2, max: 4, step: 0.01, default: 2.8 }),
  b: real('Zuwachs', { latex: 'b', min: -300, max: 300, step: 0.5, default: 50 }),
}
const artVisible = { a: (p: any) => p.art !== 'wurzel', b: (p: any) => p.art === 'linear' }

const fixModel = closedForm({
  id: 'vs-fixpunkte',
  params: {
    ...artParams,
    fenster: real('Fenster bis', { latex: 'X', min: 0.5, max: 1000, step: 0.5, default: 1 }),
  },
  domain: (p) => [p.art === 'wurzel' ? 0 : -0.1 * p.fenster, 1.1 * p.fenster],
  samples: 600,
  curves: { f: { label: 'f(x)', f: (x, p) => f(p as FP)(x) } },
  extraSeries: ({ p }) => {
    const { xs } = fixpunkte(p as FP)
    return [points('fix', 'x^*', xs.map((x) => [x, x]), 'secondary', { name: 'stationär', legend: false })]
  },
  observables: ({ p }) => {
    const { xs, alle } = fixpunkte(p as FP)
    if (!xs.length) return { fix: category('stationäre Zustände', alle ? 'jedes x' : 'keine') }
    return { fix: list('stationäre Zustände $x^*$', xs, { names: xs.map((_, i) => fixLabel(p as FP, i, xs.length)), marks: xs.map((x, item) => ({ kind: 'point', x, y: x, in: 'map', item })) }) }
  },
})

const fixApplet = (id: string, title: string, scenarios: Scenarios) =>
  defineApplet({
    id,
    title,
    summary: 'x = f(x): Schnittpunkte mit der Diagonale',
    chapter: 'I',
    model: fixModel,
    formulas: (p) => [
      { label: 'Vorschrift', tex: vorschrift(p as FP) },
      { label: 'Fixpunktgleichung', tex: String.raw`x = f(x)` },
    ],
    plots: [
      {
        type: 'functionGraph',
        series: ['f', 'fix'],
        diagonal: true,
        xLabel: 'x',
        yLabel: 'f(x)',
        x: (p) => [0, p.fenster],
        y: (p) => [0, p.fenster],
        drag: [
          { param: 'b', axis: 'y', at: (p) => (p.art === 'linear' ? [0, p.b] : null), set: (_x, y) => ({ b: y }) },
          { param: 'a', label: String.raw`f(\tfrac12)`, axis: 'y', at: (p) => (p.art === 'logistisch' ? [0.5, p.a / 4] : null), set: (_x, y) => ({ a: 4 * y }) },
        ],
        // each stationary state named on the x axis
        guides: (p): readonly Guide[] => {
          const { xs } = fixpunkte(p as FP)
          return xs.map((x, i) => ({ kind: 'drop' as const, from: [x, x] as const, to: [x, 0] as const, label: `${fixLabel(p as FP, i, xs.length)} ${approx(x)}` }))
        },
      },
    ],
    layout: { main: ['art', 'a', 'b', 'fenster'], visible: artVisible },
    readouts: ['fix'],
    scenarios,
  })

const LOG28 = { art: 'logistisch', a: 2.8, fenster: 1 }
const fix36 = fixApplet('vs-fixpunkte-36', 'Stationäre Zustände grafisch', [
  { label: 'Folie 36', text: 'f(y) = 2.8 y (1 − y): y* = 0 und y* ≈ 0.643.', params: LOG28 },
  { label: 'a = 3.2', params: { ...LOG28, a: 3.2 } },
])
const fix37 = fixApplet('vs-fixpunkte-37', 'Beispiel: Medikament', [
  { label: 'Folie 37', text: 'x_{n+1} = 0.8 x_n + 50: x* = 50/0.2 = 250.', params: { art: 'linear', a: 0.8, b: 50, fenster: 400 } },
  { label: 'doppelte Dosis', text: 'b = 100: x* = 500.', params: { art: 'linear', a: 0.8, b: 100, fenster: 600 } },
])
const fix38 = fixApplet('vs-fixpunkte-38', 'Gibt es immer einen stationären Zustand?', [
  { label: 'Folie 38', text: 'f(x) = x + 0.5 liegt parallel zur Diagonale.', params: { art: 'linear', a: 1, b: 0.5, fenster: 3 } },
  { label: 'a = 0.9', text: 'Ein wenig flacher: es gibt wieder einen Schnittpunkt.', params: { art: 'linear', a: 0.9, b: 0.5, fenster: 6 } },
])
const fix39 = fixApplet('vs-fixpunkte-39', 'Beispiel: Wurzelfunktion', [{ label: 'Folie 39', text: 'x = √x: x = 0 oder x = 1.', params: { art: 'wurzel', fenster: 2 } }])
const fix40 = fixApplet('vs-fixpunkte-40', 'Beispiel: logistisches Wachstum', [
  { label: 'Folie 40: a = 2.8', text: 'y* = 1 − 1/2.8 ≈ 0.643.', params: LOG28 },
  { label: 'a = 3.2', text: 'y* = 1 − 1/3.2 = 0.6875.', params: { ...LOG28, a: 3.2 } },
])

// ------------------------------------------------------ Folien 41–42: Langzeitverhalten

const langzeitModel = iteration({
  id: 'vs-langzeit',
  params: {
    a: real('Wachstumsrate', { latex: 'a', min: 0, max: 4, step: 0.01, default: 2.8 }),
    y0: real('Startwert', { latex: 'y_0', min: 0, max: 1, step: 0.01, default: 0.1 }),
    N: steps('Schritte', { latex: 'N', default: 40, max: 300 }),
  },
  start: (p) => p.y0,
  step: (y, p) => p.a * y * (1 - y),
  horizon: (p) => p.N,
  series: { id: 'y', label: 'y_n' },
  extraSeries: ({ p }) => (p.a > 1 ? [segment('fix', `y^* ${approx(1 - 1 / p.a)}`, [0, 1 - 1 / p.a], [p.N, 1 - 1 / p.a], 'reference', { name: 'stationär' })] : []),
  observables: ({ p }) => ({ fix: quantity('stationärer Zustand $y^* = 1 - 1/a$', p.a > 1 ? 1 - 1 / p.a : null, { digits: 4, note: 'nur für a > 1', marks: p.a > 1 ? [{ kind: 'value', v: 1 - 1 / p.a }] : [] }) }),
})
const langzeitApplet = (id: string, title: string, scenarios: Scenarios) =>
  defineApplet({
    id,
    title,
    summary: 'y_{n+1} = a y_n (1 − y_n) und y* = 1 − 1/a',
    chapter: 'I',
    model: langzeitModel,
    horizon: 'N',
    formulas: [
      { label: 'Vorschrift', tex: String.raw`y_{n+1} = {{a}}{{*}}y_n\,(1 - y_n)` },
      { label: 'Start', tex: String.raw`y_0 = {{#y0}}` },
    ],
    plots: [{ type: 'timeSeriesDiscrete', series: ['y', 'fix'], xLabel: 'n', yLabel: 'y_n', y: [0, 1], drag: { param: 'y0', axis: 'y' } }],
    readouts: ['fix'],
    scenarios,
  })
const langzeit41 = langzeitApplet('vs-langzeit-41', 'Welches Langzeitverhalten ist möglich?', [
  { label: 'Folie 41', text: 'a = 2.8: die Folge pendelt sich bei y* ≈ 0.643 ein.', params: { a: 2.8, y0: 0.1, N: 40 } },
  { label: 'anderer Start', params: { a: 2.8, y0: 0.9, N: 40 } },
])
const langzeit42 = langzeitApplet('vs-langzeit-42', 'Was der Satz nicht sagt', [
  { label: 'Folie 42', text: 'a = 3.2: y* = 0.6875 gibt es, aber die Folge erreicht ihn nicht.', params: { a: 3.2, y0: 0.1, N: 40 } },
  { label: 'Start in y*', text: 'Nur wer genau in y* startet, bleibt dort.', params: { a: 3.2, y0: 0.6875, N: 40 } },
  { label: 'Chaos', params: { a: 3.9, y0: 0.1, N: 60 } },
])

// ------------------------------------------------------- Folien 44–55: Spinnwebdiagramme

const spinnwebModel = iteration({
  id: 'vs-spinnweb',
  params: {
    ...artParams,
    x0: real('Startwert', { latex: 'x_0', min: 0, max: 400, step: 0.01, default: 10 }),
    zwei: bool('zweiter Start', { default: false, labelOn: 'an', labelOff: 'aus' }),
    x0b: real('zweiter Startwert', { latex: 'z_0', min: 0, max: 400, step: 0.01, default: 190 }),
    fenster: real('Fenster bis', { latex: 'X', min: 0.05, max: 1000, step: 0.01, default: 150 }),
    N: steps('Schritte', { latex: 'N', default: 10, max: 200 }),
  },
  start: (p) => p.x0,
  step: (x, p) => f(p as FP)(x),
  horizon: (p) => p.N,
  extraSeries: ({ p, detail }) => {
    const F = f(p as FP)
    const [lo, hi] = detail?.x ?? [0, p.fenster]
    const w = hi - lo
    const g = sample(F, p.art === 'wurzel' ? Math.max(0, lo - w) : lo - w, hi + w, 1201)
    const { xs } = fixpunkte(p as FP)
    return [
      { id: 'f', label: 'f(x)', kind: 'continuous', x: g.x, y: g.y, role: 'primary' },
      seq('x2', 'z_n', iterate(p.zwei ? p.x0b : NaN, F, p.N), 'tertiary', { name: 'zweiter Start', legend: p.zwei }),
      points('fix', 'x^*', xs.map((x) => [x, x]), 'data', { legend: false }),
    ]
  },
  observables: ({ p, x }) => {
    const { xs } = fixpunkte(p as FP)
    const d = xs.map(df(p as FP))
    return {
      xN: quantity('$x_N$', x[x.length - 1], { digits: 7 }),
      fix: list('stationäre Zustände $x^*$', xs, { digits: 4, names: xs.map((_, i) => fixLabel(p as FP, i, xs.length)), marks: xs.map((v, item) => ({ kind: 'value', v, item })) }),
      steigung: list("Steigung $f'(x^*)$", d.map((v) => (Number.isFinite(v) ? v : NaN)), { digits: 3, names: xs.map((_, i) => `f'(${fixLabel(p as FP, i, xs.length)})`) }),
    }
  },
})

const spinnwebApplet = (id: string, title: string, scenarios: Scenarios) =>
  defineApplet({
    id,
    title,
    summary: 'die Treppe zwischen Graph und Diagonale',
    chapter: 'I',
    model: spinnwebModel,
    horizon: 'N',
    formulas: (p) => [
      { label: 'Vorschrift', tex: vorschrift(p as FP) },
      { label: 'Start', tex: p.zwei ? String.raw`x_0 = {{#x0}}, \quad z_0 = {{#x0b}}` : String.raw`x_0 = {{#x0}}` },
    ],
    plots: [
      {
        type: 'cobweb',
        f: 'f',
        orbit: 'x',
        orbits: ['x2'],
        series: ['fix'],
        xLabel: 'x',
        yLabel: 'f(x)',
        x: (p) => [0, p.fenster],
        y: (p) => [0, p.fenster],
        stretch: true,
        drag: [
          { param: 'x0', axis: 'x' },
          { param: 'x0b', axis: 'x', at: (p) => (p.zwei ? [p.x0b, 0] : null) },
        ],
        // the value just reached, on the x axis
        guides: (_p: unknown, { step, run }: { step: number; run: Run }): readonly Guide[] => {
          const x = run.series.find((s) => s.id === 'x')?.y
          const k = Math.min(step, (x?.length ?? 0) - 1)
          if (!x || k < 1 || !Number.isFinite(x[k])) return []
          return [{ kind: 'drop', from: [x[k], x[k]], to: [x[k], 0], label: `x_{${k}}` }]
        },
      },
    ],
    layout: { main: ['art', 'a', 'b', 'x0', 'zwei', 'x0b'], visible: { ...artVisible, x0b: (p: any) => p.zwei } },
    readouts: ['xN', 'fix', 'steigung'],
    scenarios,
  })

const LIN = (a: number, b: number, x0: number, x0b: number | null, N: number, fenster = 200) => ({ art: 'linear', a, b, x0, zwei: x0b !== null, x0b: x0b ?? 190, N, fenster })
const spinnweb44 = spinnwebApplet('vs-spinnweb-44', 'Das Spinnwebdiagramm', [
  { label: 'Folie 44: x₁', text: 'x_{n+1} = 0.5 x_n + 50, x₀ = 10: senkrecht zum Graphen, waagrecht zur Diagonale.', params: LIN(0.5, 50, 10, null, 1, 150) },
  { label: 'x₂', params: LIN(0.5, 50, 10, null, 2, 150) },
  { label: 'x₃', params: LIN(0.5, 50, 10, null, 3, 150) },
  { label: 'bis x*', text: 'Die Treppe läuft in den Schnittpunkt x* = 100.', params: LIN(0.5, 50, 10, null, 15, 150) },
])
const spinnweb45 = spinnwebApplet('vs-spinnweb-45', 'Lineare Differenzengleichung mit 0 < a < 1', [
  { label: 'Folie 45', text: 'Start unterhalb (10) und oberhalb (190): beide Treppen laufen zu x* = 100.', params: LIN(0.5, 50, 10, 190, 15) },
])
const spinnweb46 = spinnwebApplet('vs-spinnweb-46', 'Lineare Differenzengleichung mit a > 1', [
  { label: 'Folie 46', text: 'x_{n+1} = 1.5 x_n − 50, Start bei 90 und 110: beide Treppen laufen weg.', params: LIN(1.5, -50, 90, 110, 8) },
])
const spinnweb47 = spinnwebApplet('vs-spinnweb-47', 'Lineare Differenzengleichung mit a < 0', [
  { label: 'Folie 47: a = −0.5', text: 'Spirale nach innen, x* = 100.', params: LIN(-0.5, 150, 20, null, 15) },
  { label: 'a = −1.2', text: 'Spirale nach außen, x* = 100.', params: LIN(-1.2, 220, 110, null, 12) },
])
const spinnweb48 = spinnwebApplet('vs-spinnweb-48', 'Langzeitverhalten linearer Differenzengleichungen', [
  { label: 'a = 1.5', text: 'weg, monoton', params: LIN(1.5, -50, 90, 110, 8) },
  { label: 'a = 0.5', text: 'hin, monoton', params: LIN(0.5, 50, 10, 190, 15) },
  { label: 'a = −0.5', text: 'hin, pendelnd', params: LIN(-0.5, 150, 20, null, 15) },
  { label: 'a = −1.2', text: 'weg, pendelnd', params: LIN(-1.2, 220, 110, null, 12) },
])
const spinnweb51 = spinnwebApplet('vs-spinnweb-51', 'Nichtlineare Beispiele', [
  { label: 'Folie 51: √x', text: 'Start bei 0.05 und 1.8: beide Treppen laufen zu x* = 1.', params: { art: 'wurzel', x0: 0.05, zwei: true, x0b: 1.8, N: 10, fenster: 2 } },
  { label: '1.8 y (1 − y)', text: 'Die Treppe läuft zu y* = 1 − 1/1.8 ≈ 0.444.', params: { art: 'logistisch', a: 1.8, x0: 0.02, zwei: false, N: 15, fenster: 0.6 } },
])
const spinnweb55 = spinnwebApplet('vs-spinnweb-55', 'Stabilität bei der Wurzelfunktion', [
  { label: 'Folie 55', text: 'Start bei 1.8 läuft zurück zu 1, Start bei 0.02 läuft von 0 weg.', params: { art: 'wurzel', x0: 0.02, zwei: true, x0b: 1.8, N: 10, fenster: 2 } },
  { label: 'Folie 53', text: 'Start nahe 0 (0.01) und nahe 1 (1.01).', params: { art: 'wurzel', x0: 0.01, zwei: true, x0b: 1.01, N: 6, fenster: 2 } },
])
const spinnweb68 = spinnwebApplet('vs-spinnweb-68', 'Idee 1: einfach iterieren', [
  { label: 'Folie 68', text: 'x_{n+1} = 1 − e^{−2x_n}, x₀ = 0.5: x₄₀ ≈ 0.7968, langsam.', params: { art: 'epidemie', a: 2, x0: 0.5, zwei: false, N: 40, fenster: 1 } },
  { label: 'die ersten Schritte', params: { art: 'epidemie', a: 2, x0: 0.5, zwei: false, N: 3, fenster: 1 } },
])

// ---------------------------------------------------------- Folien 56–59: Blick durch die Lupe

type LP = { art: 'wurzel' | 'logistisch'; a: number; fix: 'null' | 'innen'; x0: number; w: number }
const lupeF = (p: LP) => f({ art: p.art, a: p.a, b: 0 })
const lupeDf = (p: LP) => df({ art: p.art, a: p.a, b: 0 })
/** The stationary state under the lens: 0, or the other one (1 for √x, 1 − 1/a). */
const stern = (p: LP) => (p.fix === 'null' ? 0 : p.art === 'wurzel' ? 1 : p.a > 0 ? 1 - 1 / p.a : 0)
const ueberblick = (p: LP): [number, number] => (p.art === 'wurzel' ? [0, 2] : [0, 1])
/** The lens: a square of half width w around x*, moved up to 0 where f has nothing below. */
const fenster = (p: LP): [number, number] => {
  const lo = Math.max(0, stern(p) - p.w)
  return [lo, lo + 2 * p.w]
}

const lupeModel = iteration({
  id: 'vs-lupe',
  params: {
    art: choice(
      'Aktualisierungsfunktion',
      [
        { value: 'wurzel', label: '$\\sqrt{x}$' },
        { value: 'logistisch', label: '$a\\,y\\,(1 - y)$' },
      ],
      'wurzel',
    ),
    a: real('Wachstumsrate', { latex: 'a', min: 0, max: 4, step: 0.01, default: 2.6 }),
    fix: choice(
      'stationärer Zustand',
      [
        { value: 'null', label: '$x^* = 0$' },
        { value: 'innen', label: 'der andere' },
      ],
      'innen',
    ),
    x0: real('Startwert', { latex: 'x_0', min: 0, max: 2, step: 0.001, default: 0.92 }),
    w: real('halbe Breite der Lupe', { latex: 'w', min: 0.005, max: 0.5, step: 0.005, default: 0.1 }),
    N: steps('Schritte', { latex: 'N', default: 10, max: 100 }),
  },
  start: (p) => p.x0,
  step: (x, p) => lupeF(p as LP)(x),
  horizon: (p) => p.N,
  extraSeries: ({ p }) => {
    const P = p as LP
    const F = lupeF(P)
    const [u0, u1] = ueberblick(P)
    const g = sample(F, u0, u1, 4001)
    const s = stern(P)
    const d = lupeDf(P)(s)
    const out: Series[] = [{ id: 'f', label: 'f', kind: 'continuous', x: g.x, y: g.y, role: 'primary' }]
    if (Number.isFinite(d)) {
      const t = (x: number) => s + d * (x - s)
      out.push(
        segment('t', 't', [u0 - 1, t(u0 - 1)], [u1 + 1, t(u1 + 1)], 'tertiary', { name: 'Tangente' }),
        seq('tx', 't', iterate(P.x0, t, p.N), 'tertiary', { name: 'Treppe der Tangente', dash: [5, 4] }),
      )
    }
    const [l0, l1] = fenster(P)
    out.push(
      { id: 'rahmen', label: 'Lupe', kind: 'continuous', x: Float64Array.of(l0, l1, l1, l0, l0), y: Float64Array.of(l0, l0, l1, l1, l0), role: 'annotation' },
      points('stern', 'x^*', [[s, s]], 'data', { legend: false }),
    )
    return out
  },
  observables: ({ p }) => {
    const P = p as LP
    const s = stern(P)
    const d = lupeDf(P)(s)
    const art = !Number.isFinite(d) ? 'f ist dort nicht differenzierbar' : Math.abs(d) < 1 ? 'stabil' : Math.abs(d) > 1 ? 'instabil' : 'keine Aussage'
    return {
      stern: quantity('stationärer Zustand $x^*$', s, { digits: 4 }),
      steigung: quantity("Steigung $f'(x^*)$", Number.isFinite(d) ? d : null, { digits: 3, note: 'nicht differenzierbar' }),
      art: category('Kriterium', art),
    }
  },
})

const lupeApplet = (id: string, title: string, scenarios: Scenarios) =>
  defineApplet({
    id,
    title,
    summary: 'Nahe x* verhält sich die Treppe wie die der Tangente',
    chapter: 'I',
    model: lupeModel,
    horizon: 'N',
    formulas: (p) => {
      const P = p as LP
      const s = stern(P)
      const d = lupeDf(P)(s)
      return [
        { label: 'Vorschrift', tex: P.art === 'wurzel' ? String.raw`x_{n+1} = \sqrt{x_n}` : String.raw`y_{n+1} = {{a}}{{*}}y_n\,(1 - y_n)` },
        ...(Number.isFinite(d) ? [{ label: 'Tangente in x*', tex: String.raw`t(x) = ${+s.toFixed(4)} ${d < 0 ? '-' : '+'} ${+Math.abs(d).toFixed(3)}\,(x - ${+s.toFixed(4)})` }] : []),
      ]
    },
    plots: [
      { type: 'cobweb', f: 'f', orbit: 'x', series: ['t', 'rahmen', 'stern'], title: 'Überblick', xLabel: 'x', yLabel: 'f(x)', x: (p) => ueberblick(p as LP), y: (p) => ueberblick(p as LP) },
      {
        type: 'cobweb',
        f: 'f',
        orbit: 'x',
        orbits: ['tx'],
        series: ['t', 'stern'],
        title: 'Lupe',
        xLabel: 'x',
        yLabel: 'f(x)',
        x: (p) => fenster(p as LP),
        y: (p) => fenster(p as LP),
        drag: [{ param: 'x0', axis: 'x', at: (p) => [p.x0, fenster(p as LP)[0]], set: (x) => ({ x0: x }) }],
      },
    ],
    layout: { main: ['art', 'a', 'fix', 'x0', 'w'], visible: { a: (p) => p.art === 'logistisch' } },
    readouts: ['stern', 'steigung', 'art'],
    scenarios,
  })

const lupe56 = lupeApplet('vs-lupe-56', "Blick durch die Lupe: 0 < f'(x*) < 1", [
  { label: 'Folie 56', text: "√x bei x* = 1: f'(1) = ½. Beide Treppen laufen nach x*.", params: { art: 'wurzel', fix: 'innen', x0: 0.91, w: 0.1, N: 8 } },
])
const lupe57 = lupeApplet('vs-lupe-57', "Blick durch die Lupe: f'(x*) > 1", [
  { label: 'Folie 57', text: "1.8 y (1 − y) bei y* = 0: f'(0) = 1.8. Beide Treppen laufen weg.", params: { art: 'logistisch', a: 1.8, fix: 'null', x0: 0.004, w: 0.02, N: 4 } },
])
const lupe58 = lupeApplet('vs-lupe-58', "Blick durch die Lupe: −1 < f'(x*) < 0", [
  { label: 'Folie 58', text: "2.6 y (1 − y) bei y* ≈ 0.615: f'(y*) = −0.6. Beide spiralen nach innen.", params: { art: 'logistisch', a: 2.6, fix: 'innen', x0: 0.66, w: 0.06, N: 12 } },
])
const lupe59 = lupeApplet('vs-lupe-59', "Blick durch die Lupe: f'(x*) < −1", [
  { label: 'Folie 59', text: "3.2 y (1 − y) bei y* = 0.6875: f'(y*) = −1.2. Beide spiralen nach außen.", params: { art: 'logistisch', a: 3.2, fix: 'innen', x0: 0.7, w: 0.08, N: 12 } },
  { label: 'länger', text: 'Im Überblick landet die Folge auf zwei Werten.', params: { art: 'logistisch', a: 3.2, fix: 'innen', x0: 0.7, w: 0.08, N: 60 } },
])

// --------------------------------------------- Folien 63–64: Stabilität im Bifurkationsdiagramm

const A_KRITISCH = 3
const bifurkation = defineApplet({
  id: 'vs-bifurkation',
  title: 'Stabilität im Bifurkationsdiagramm',
  summary: "y* = 1 − 1/a ist stabil für 1 < a < 3, denn f'(y*) = 2 − a",
  chapter: 'I',
  model: iteration({
    id: 'vs-bifurkation',
    params: {
      a: real('Wachstumsrate', { latex: 'a', min: 2.4, max: 4, step: 0.001, default: 2.8 }),
      N: steps('Schritte', { latex: 'N', default: 50, max: 300 }),
    },
    start: () => 0.1,
    step: (y, p) => p.a * y * (1 - y),
    horizon: (p) => p.N,
    series: { id: 'y', label: 'y_n' },
    extraSeries: ({ p }) => {
      const d = bifurcation(2.4, 4, 0, 1)
      const ast = (lo: number, hi: number) => sample((a) => 1 - 1 / a, lo, hi, 100)
      const [s, u] = [ast(2.4, A_KRITISCH), ast(A_KRITISCH, 4)]
      const ys = 1 - 1 / p.a
      return [
        { id: 'diagramm', label: 'y', name: 'Langzeitwerte', kind: 'discrete', x: d.x, y: d.y, role: 'ghost', connect: false },
        { id: 'stabil', label: 'y^* = 1 - \\tfrac1a', name: 'stabil', kind: 'continuous', x: s.x, y: s.y, role: 'secondary', dash: [] },
        { id: 'instabil', label: 'y^*', name: 'instabil', kind: 'continuous', x: u.x, y: u.y, role: 'secondary', dash: [6, 4] },
        segment('drei', '', [A_KRITISCH, 0], [A_KRITISCH, 1], 'reference', { dash: [2, 3], legend: false }),
        segment('jetzt', 'a', [p.a, 0], [p.a, 1], 'annotation', { legend: false }),
        points('punkt', 'y^*', [[p.a, ys]], 'secondary', { legend: false }),
        segment('fixZeit', 'y^*', [0, ys], [p.N, ys], 'reference', { name: 'stationär' }),
      ]
    },
    observables: ({ p }) => {
      const d = 2 - p.a
      return {
        fix: quantity('$y^* = 1 - 1/a$', 1 - 1 / p.a, { digits: 4 }),
        steigung: quantity("$f'(y^*) = 2 - a$", d, { digits: 3 }),
        art: category('Kriterium', Math.abs(d) < 1 ? 'stabil' : Math.abs(d) > 1 ? 'instabil' : 'keine Aussage'),
      }
    },
  }),
  horizon: 'N',
  formulas: [
    { label: 'Vorschrift', tex: String.raw`y_{n+1} = {{a}}{{*}}y_n\,(1 - y_n)` },
    { label: 'Ableitung', tex: String.raw`f'(y) = a - 2a\,y, \quad f'(y^*) = 2 - a` },
  ],
  plots: [
    {
      type: 'scatter',
      series: ['diagramm', 'stabil', 'instabil', 'drei', 'jetzt', 'punkt'],
      xLabel: 'a',
      yLabel: 'y',
      x: [2.4, 4],
      y: [0, 1],
      drag: [{ param: 'a', axis: 'x', at: (p) => [p.a, 0.96], set: (x) => ({ a: x }) }],
    },
    { type: 'timeSeriesDiscrete', series: ['y', 'fixZeit'], xLabel: 'n', yLabel: 'y_n', y: [0, 1] },
  ],
  readouts: ['fix', 'steigung', 'art'],
  scenarios: [
    { label: 'Folie 64: a = 2.8', text: "f'(y*) = −0.8: stabil, die Folge landet auf y*.", params: { a: 2.8, N: 50 } },
    { label: 'a = 3.2', text: "f'(y*) = −1.2: instabil, die Folge springt zwischen zwei Werten.", params: { a: 3.2, N: 50 } },
    { label: 'a = 3.5', params: { a: 3.5, N: 50 } },
  ],
})

// ------------------------------------------------------------ Folien 69–72: Newton-Verfahren

const newtonV = defineApplet({
  ...newton,
  id: 'vs-newton',
  title: 'Das Newton-Verfahren',
  summary: 'x_{n+1} = x_n − g(x_n)/g′(x_n)',
  chapter: 'I',
  scenarios: [
    { label: 'Folie 69', text: 'g(x) = 1 − e^{−2x} − x ab x₀ = 1.6: die Nullstelle der Tangente ist x₁.', params: { g: 'epidemie', x0: 1.6, N: 2 } },
    { label: 'Folie 71', text: 'Ab x₀ = 1: 0.8144387, 0.7970151, 0.7968121582, … etwa 80 % erkranken.', params: { g: 'epidemie', x0: 1, N: 4 } },
    { label: 'Folie 72: Heron', text: 'g(x) = x² − 2: das Newton-Verfahren ist das Heron-Verfahren.', params: { g: 'quadrat', x0: 0.5, N: 5 } },
  ],
})

// ------------------------------------------------- Folie 73: Stabilität numerisch entscheiden

const NUM = {
  sqrt: { label: '$\\sqrt{x}$ bei $x^* = 1$', f: Math.sqrt, x: 1, d: 0.5 },
  logistisch: { label: '$3.2\\,y\\,(1-y)$ bei $y^* = 0.6875$', f: logistic(3.2), x: 0.6875, d: -1.2 },
  exp: { label: '$e^x$ bei $0$', f: Math.exp, x: 0, d: 1 },
} as const
type NumId = keyof typeof NUM
const quotientAt = (id: NumId, zentral: boolean, k: number) => {
  const { f: F, x } = NUM[id]
  const h = 10 ** -k
  return zentral ? (F(x + h) - F(x - h)) / (2 * h) : (F(x + h) - F(x)) / h
}
const fehler = (id: NumId, zentral: boolean, k: number) => Math.max(Math.abs(quotientAt(id, zentral, k) - NUM[id].d), 1e-17)
const besterK = (id: NumId, zentral: boolean) => {
  let best = 1
  for (let k = 1; k <= 16; k++) if (fehler(id, zentral, k) < fehler(id, zentral, best)) best = k
  return best
}

const numerisch = defineApplet({
  id: 'vs-numerisch',
  title: 'Stabilität numerisch entscheiden',
  summary: 'Der Fehler des Differenzenquotienten für h = 10^{−k}',
  chapter: 'I',
  model: closedForm({
    id: 'vs-numerisch',
    params: {
      fn: choice('Funktion', (Object.keys(NUM) as NumId[]).map((value) => ({ value, label: NUM[value].label })), 'sqrt'),
      zentral: bool('zentraler Differenzenquotient', { default: false, labelOn: 'an', labelOff: 'aus' }),
      k: int('Schrittweite', { latex: 'k', min: 1, max: 16, default: 4 }),
    },
    domain: () => [1, 16],
    discrete: true,
    curves: { fehler: { label: '\\text{Fehler}', f: (k, p) => fehler(p.fn, p.zentral, k) } },
    extraSeries: ({ p }) => {
      const b = besterK(p.fn, p.zentral)
      return [
        segment('bester', `\\text{bestes } h = 10^{-${b}}`, [b, 1e-17], [b, 10], 'reference', { name: '' }),
        points('jetzt', 'h', [[p.k, fehler(p.fn, p.zentral, p.k)]], 'secondary', { legend: false }),
      ]
    },
    observables: ({ p }) => ({
      D: quantity("Differenzenquotient $\\approx f'(x^*)$", quotientAt(p.fn, p.zentral, p.k), { digits: 12 }),
      fehler: quantity('Fehler', fehler(p.fn, p.zentral, p.k), { digits: 2 }),
      bester: index('bestes $k$', besterK(p.fn, p.zentral), { marks: [{ kind: 'time', t: besterK(p.fn, p.zentral) }] }),
    }),
  }),
  formulas: (p) => [
    { label: 'Näherung', tex: p.zentral ? String.raw`f'(x^*) \approx \frac{f(x^* + h) - f(x^* - h)}{2h}` : String.raw`f'(x^*) \approx \frac{f(x^* + h) - f(x^*)}{h}` },
    { label: 'Schrittweite', tex: String.raw`h = 10^{-{{k}}}` },
  ],
  plots: [
    {
      type: 'timeSeriesContinuous',
      series: ['fehler', 'bester', 'jetzt'],
      xLabel: 'k \\text{ mit } h = 10^{-k}',
      yLabel: '\\text{Fehler}',
      x: [0.5, 16.5],
      yScale: 'log',
      yLogRange: [1e-17, 10],
      drag: [{ param: 'k', axis: 'x', at: (p) => [p.k, fehler(p.fn, p.zentral, p.k)], set: (x) => ({ k: Math.max(1, Math.min(16, Math.round(x))) }) }],
    },
  ],
  layout: { main: ['fn', 'zentral', 'k'] },
  readouts: ['D', 'fehler', 'bester'],
  scenarios: [
    { label: 'Folie 73', text: "√x bei 1: h zu groß, Sekante ≠ Tangente; h zu klein, Rundungsfehler. Am besten h ≈ 10⁻⁸.", params: { fn: 'sqrt', zentral: false, k: 8 } },
    { label: 'logistisch', text: "f'(y*) = −1.2 bei a = 3.2.", params: { fn: 'logistisch', zentral: false, k: 8 } },
    { label: 'zentral', text: 'Der zentrale Differenzenquotient: am besten bei h ≈ 10⁻⁵.', params: { fn: 'sqrt', zentral: true, k: 5 } },
  ],
})

export const stabilitaet: AppletModule<any>[] = [
  rueckblick,
  stetigkeit,
  ableitung,
  tangente,
  fix36,
  fix37,
  fix38,
  fix39,
  fix40,
  langzeit41,
  langzeit42,
  spinnweb44,
  spinnweb45,
  spinnweb46,
  spinnweb47,
  spinnweb48,
  spinnweb51,
  spinnweb55,
  lupe56,
  lupe57,
  lupe58,
  lupe59,
  bifurkation,
  spinnweb68,
  newtonV,
  numerisch,
]
