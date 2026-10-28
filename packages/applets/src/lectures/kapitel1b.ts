// Vorlesung, Kapitel 1b (Differenzengleichungen): one applet per visualisation of the slides,
// fully interactive (parameters, equation box, handles), with the slides' parameters as
// scenarios. For the beamer; registered in ../index.ts, not in the gallery.

import { category, choice, closedForm, index, iteration, iterationN, quantity, real, steps, type Series } from '@abacus/applet-core'
import { defineApplet, type AppletModule } from '@abacus/applet-ui/define'
import heron from '../heron'
import logisticCobweb from '../logistic-cobweb'
import { bifurcation } from '../logistic-bifurcation'

/** A number for a legend or label: at most four decimals, no trailing zeros. */
const num = (v: number) => String(+v.toFixed(4))

/** A sequence drawn from values, for the extra series of an iteration. */
const seq = (id: string, label: string, y: Float64Array, role: Series['role'], name?: string): Series => ({
  id,
  label,
  name,
  kind: 'discrete',
  x: Float64Array.from(y, (_, k) => k),
  y,
  role,
})
const line = (id: string, label: string, x: readonly [number, number], v: number, role: Series['role'], name?: string): Series => ({
  id,
  label,
  name,
  kind: 'continuous',
  x: Float64Array.of(x[0], x[1]),
  y: Float64Array.of(v, v),
  role,
  dash: [5, 4],
})
const iterate = (x0: number, f: (x: number) => number, N: number) => {
  const y = new Float64Array(N + 1)
  y[0] = x0
  for (let k = 0; k < N; k++) y[k + 1] = f(y[k])
  return y
}

// ------------------------------------------------------------------------- Folie 3: Heron

const heronV = defineApplet({
  ...heron,
  id: 'v1b-heron',
  title: 'Beispiel: Aktualisierungsfunktion',
  summary: 'f(x) = ½ (x + 2/x)',
  chapter: 'I',
  // only the cobweb, in the slide's window: no plot of the error
  plots: [{ ...heron.plots[0], x: [0, 5], y: [0, 5], stretch: true }],
  scenarios: [
    { label: 'Folie 3: der erste Schritt', text: 'x₀ = 0.5, ein Schritt zu x₁.', params: { x0: 0.5, N: 1 } },
    { label: 'weiter', text: 'Die nächsten Schritte von x₀ = 0.5 aus.', params: { x0: 0.5, N: 6 } },
  ],
})

// ------------------------------------------------- Folie 14: zwei arithmetische Progressionen

const arithmetisch = defineApplet({
  id: 'v1b-arithmetisch',
  title: 'Lösungsformel der arithmetischen Progression',
  summary: 'x_n = x_0 + n b',
  chapter: 'I',
  model: iteration({
    id: 'v1b-arithmetisch',
    params: {
      x0: real('Startwert', { latex: 'x_0', min: -50, max: 50, step: 0.5, default: 20 }),
      b1: real('Zuwachs (1. Folge)', { latex: 'b_1', min: -5, max: 5, step: 0.05, default: 1 }),
      b2: real('Zuwachs (2. Folge)', { latex: 'b_2', min: -5, max: 5, step: 0.05, default: -0.5 }),
      N: steps('Schritte', { latex: 'N', default: 20, max: 100 }),
    },
    start: (p) => p.x0,
    step: (x, p) => x + p.b1,
    horizon: (p) => p.N,
    extraSeries: ({ p }) => [
      seq('s1', `b = ${num(p.b1)}`, iterate(p.x0, (x) => x + p.b1, p.N), 'primary'),
      seq('s2', `b = ${num(p.b2)}`, iterate(p.x0, (x) => x + p.b2, p.N), 'secondary'),
    ],
  }),
  horizon: 'N',
  formulas: [
    { label: 'Vorschrift', tex: String.raw`x_{n+1} = x_n + b, \quad b = {{#b1}} \text{ und } {{#b2}}` },
    { label: 'Start', tex: String.raw`x_0 = {{#x0}}` },
    { label: 'Lösung', tex: String.raw`x_n = x_0 + n\,b` },
  ],
  plots: [
    {
      type: 'timeSeriesDiscrete',
      series: ['s1', 's2'],
      xLabel: 'n',
      yLabel: 'x_n',
      drag: [
        { param: 'x0', axis: 'y' },
        { param: 'b1', label: 'x_N', axis: 'y', at: (p) => [p.N, p.x0 + p.N * p.b1], set: (_x, y, p) => ({ b1: (y - p.x0) / Math.max(1, p.N) }) },
        { param: 'b2', label: 'x_N', axis: 'y', at: (p) => [p.N, p.x0 + p.N * p.b2], set: (_x, y, p) => ({ b2: (y - p.x0) / Math.max(1, p.N) }) },
      ],
    },
  ],
  scenarios: [
    { label: 'Folie 14', text: 'b = 1 und b = −0.5 von x₀ = 20 aus.', params: { x0: 20, b1: 1, b2: -0.5, N: 20 } },
    { label: 'b = 2 und b = −2', params: { x0: 20, b1: 2, b2: -2, N: 20 } },
  ],
})

// --------------------------------------------------- Folie 16: zwei geometrische Progressionen

const geometrisch = defineApplet({
  id: 'v1b-geometrisch',
  title: 'Lösungsformel der geometrischen Progression',
  summary: 'x_n = aⁿ x_0',
  chapter: 'I',
  model: iteration({
    id: 'v1b-geometrisch',
    params: {
      x0: real('Startwert', { latex: 'x_0', min: 0, max: 50, step: 0.5, default: 10 }),
      a1: real('Faktor (1. Folge)', { latex: 'a_1', min: 0, max: 2, step: 0.01, default: 1.1 }),
      a2: real('Faktor (2. Folge)', { latex: 'a_2', min: 0, max: 2, step: 0.01, default: 0.8 }),
      N: steps('Schritte', { latex: 'N', default: 25, max: 100 }),
    },
    start: (p) => p.x0,
    step: (x, p) => p.a1 * x,
    horizon: (p) => p.N,
    extraSeries: ({ p }) => [
      seq('s1', `a = ${num(p.a1)}`, iterate(p.x0, (x) => p.a1 * x, p.N), 'primary'),
      seq('s2', `a = ${num(p.a2)}`, iterate(p.x0, (x) => p.a2 * x, p.N), 'secondary'),
    ],
  }),
  horizon: 'N',
  formulas: [
    { label: 'Vorschrift', tex: String.raw`x_{n+1} = a\,x_n, \quad a = {{#a1}} \text{ und } {{#a2}}` },
    { label: 'Start', tex: String.raw`x_0 = {{#x0}}` },
    { label: 'Lösung', tex: String.raw`x_n = a^n\,x_0` },
  ],
  plots: [
    {
      type: 'timeSeriesDiscrete',
      series: ['s1', 's2'],
      xLabel: 'n',
      yLabel: 'x_n',
      logToggle: true,
      drag: [
        { param: 'x0', axis: 'y' },
        // the last point sets the factor: x_N = a^N x₀
        { param: 'a1', label: 'x_N', axis: 'y', at: (p) => (p.x0 > 0 ? [p.N, p.x0 * p.a1 ** p.N] : null), set: (_x, y, p) => ({ a1: Math.max(0, y / p.x0) ** (1 / Math.max(1, p.N)) }) },
        { param: 'a2', label: 'x_N', axis: 'y', at: (p) => (p.x0 > 0 ? [p.N, p.x0 * p.a2 ** p.N] : null), set: (_x, y, p) => ({ a2: Math.max(0, y / p.x0) ** (1 / Math.max(1, p.N)) }) },
      ],
    },
  ],
  scenarios: [
    { label: 'Folie 16', text: 'a = 1.1 und a = 0.8 von x₀ = 10 aus.', params: { x0: 10, a1: 1.1, a2: 0.8, N: 25 } },
    { label: 'weiter', text: '50 Schritte.', params: { x0: 10, a1: 1.1, a2: 0.8, N: 50 } },
  ],
})

// ------------------------------------------------------- Folie 18: linear gegen exponentiell

const wettlauf = defineApplet({
  id: 'v1b-wettlauf',
  title: 'Arithmetisch oder geometrisch?',
  summary: '1000 + 1000 n gegen 1.1ⁿ',
  chapter: 'I',
  model: iteration({
    id: 'v1b-wettlauf',
    params: {
      c: real('Start und Zuwachs (linear)', { latex: 'c', min: 1, max: 20000, step: 100, default: 1000 }),
      a: real('Faktor (exponentiell)', { latex: 'a', min: 1.01, max: 2, step: 0.01, default: 1.1 }),
      N: steps('Schritte', { latex: 'N', default: 135, max: 400 }),
    },
    start: (p) => p.c,
    step: (x, p) => x + p.c,
    horizon: (p) => p.N,
    extraSeries: ({ p }) => [
      seq('lin', `${num(p.c)} + ${num(p.c)}\\,n`, iterate(p.c, (x) => x + p.c, p.N), 'primary'),
      seq('exp', `${num(p.a)}^n`, iterate(1, (x) => p.a * x, p.N), 'secondary'),
    ],
    observables: ({ p }) => {
      // the first n at which aⁿ is larger than c + c n
      let n = 0
      while (n < 100000 && p.a ** n <= p.c + p.c * n) n++
      return {
        ueberholt: index('exponentiell größer ab', n, { marks: [{ kind: 'time', t: n }] }),
      }
    },
  }),
  horizon: 'N',
  formulas: [
    { label: 'linear', tex: String.raw`x_n = {{#c}} + {{#c}}\,n` },
    { label: 'exponentiell', tex: String.raw`z_n = {{#a}}^n` },
  ],
  plots: [{ type: 'timeSeriesDiscrete', series: ['lin', 'exp'], xLabel: 'n', yLabel: 'x_n', logToggle: true }],
  readouts: ['ueberholt'],
  scenarios: [
    { label: 'Folie 18', text: 'Ab n = 124 liegt 1.1ⁿ vorn.', params: { c: 1000, a: 1.1, N: 135 } },
    { label: 'die ersten 50', text: 'Lange sieht es nach dem linearen Wachstum aus.', params: { c: 1000, a: 1.1, N: 50 } },
    { label: 'a = 1.2', params: { c: 1000, a: 1.2, N: 70 } },
  ],
})

// ------------------------------------------- Folien 19–20: lineare Differenzengleichung

const linear = defineApplet({
  id: 'v1b-linear',
  title: 'Lineare Differenzengleichung: Medikament',
  summary: 'x_{n+1} = a x_n + b',
  chapter: 'I',
  model: iteration({
    id: 'v1b-linear',
    params: {
      a: real('Faktor', { latex: 'a', min: 0, max: 1.2, step: 0.01, default: 0.8 }),
      b: real('Dosis', { latex: 'b', min: 0, max: 200, step: 1, default: 50 }),
      x0: real('Startwert', { latex: 'x_0', min: 0, max: 600, step: 1, default: 0 }),
      N: steps('Stunden', { latex: 'N', default: 20, max: 100 }),
    },
    start: (p) => p.x0,
    step: (x, p) => p.a * x + p.b,
    horizon: (p) => p.N,
    series: { label: 'x_n', name: 'Wirkstoff' },
    extraSeries: ({ p }) => (Math.abs(1 - p.a) < 1e-9 ? [] : [line('fix', 'x^*', [0, p.N], p.b / (1 - p.a), 'reference', 'Gleichgewicht')]),
    observables: ({ p }) => ({
      gleichgewicht: quantity('Gleichgewicht x* = b/(1 − a)', Math.abs(1 - p.a) < 1e-9 ? null : p.b / (1 - p.a), { note: 'keines für a = 1', digits: 4 }),
    }),
  }),
  horizon: 'N',
  formulas: [
    { label: 'Vorschrift', tex: String.raw`x_{n+1} = {{a}}{{*}}x_n {{+b}}` },
    { label: 'Start', tex: String.raw`x_0 = {{#x0}}` },
    { label: 'Lösung', tex: String.raw`x_n = x^* + a^n\,(x_0 - x^*), \quad x^* = \frac{b}{1 - a}` },
  ],
  plots: [{ type: 'timeSeriesDiscrete', series: ['x', 'fix'], xLabel: 'n \\text{ (Stunden)}', yLabel: 'x_n \\text{ (mg)}', drag: { param: 'x0', axis: 'y' } }],
  readouts: ['gleichgewicht'],
  scenarios: [
    { label: 'Folien 19–20', text: 'x_{n+1} = 0.8 x_n + 50, x₀ = 0: der Wirkstoff steigt auf 250 mg.', params: { a: 0.8, b: 50, x0: 0, N: 20 } },
    { label: 'doppelte Dosis', params: { a: 0.8, b: 100, x0: 0, N: 20 } },
    { label: 'schneller Abbau', params: { a: 0.5, b: 50, x0: 0, N: 20 } },
    { label: 'Start über x*', params: { a: 0.8, b: 50, x0: 450, N: 20 } },
  ],
})

// -------------------------------------------------------- Folien 22–23: Suppe im Kühlraum

const GRENZE = 10

const abkuehlung = defineApplet({
  id: 'v1b-abkuehlung',
  title: 'Newtonsches Gesetz der Abkühlung',
  summary: 'T_{n+1} = T_n + α (Tᵘ − T_n)',
  chapter: 'I',
  model: iteration({
    id: 'v1b-abkuehlung',
    params: {
      alpha: real('Wärmeübergang', { latex: '\\alpha', min: 0, max: 2.2, step: 0.01, default: 0.2 }),
      T0: real('Anfangstemperatur', { latex: 'T_0', min: -20, max: 100, step: 1, default: 80, unit: '°C' }),
      Tu: real('Umgebungstemperatur', { latex: 'T^u', min: -20, max: 40, step: 1, default: 4, unit: '°C' }),
      N: steps('Schritte zu 10 min', { latex: 'N', default: 18, max: 60 }),
    },
    start: (p) => p.T0,
    step: (T, p) => T + p.alpha * (p.Tu - T),
    horizon: (p) => p.N,
    series: { id: 'T', label: 'T_n', name: 'Suppe' },
    extraSeries: ({ p }) => [line('Tu', 'T^u', [0, p.N], p.Tu, 'reference', 'Kühlraum'), line('grenze', '', [0, p.N], GRENZE, 'tertiary', '10 °C')],
    observables: ({ x }) => {
      const n = x.findIndex((T) => T < GRENZE)
      return {
        unter: quantity('unter 10 °C nach (min)', n < 0 ? null : 10 * n, {
          digits: 4,
          note: 'nicht im Zeitfenster',
          info: 'Der erste Schritt, in dem die Suppe kälter als 10 °C ist, in Minuten (ein Schritt sind 10 Minuten).',
          marks: n < 0 ? [] : [{ kind: 'time', t: n }],
        }),
      }
    },
  }),
  horizon: 'N',
  formulas: [
    { label: 'Vorschrift', tex: String.raw`T_{n+1} = T_n + {{alpha}}\,({{Tu}} - T_n)` },
    { label: 'Start', tex: String.raw`T_0 = {{#T0}}` },
    { label: 'Lösung', tex: String.raw`T_n = (T_0 - T^u)\,(1 - \alpha)^n + T^u` },
  ],
  plots: [
    {
      type: 'timeSeriesDiscrete',
      series: ['T', 'Tu', 'grenze'],
      xLabel: 'n \\text{ (je 10 min)}',
      yLabel: 'T_n \\text{ (°C)}',
      drag: [
        { param: 'T0', axis: 'y' },
        { param: 'Tu', axis: 'y', at: (p) => [p.N, p.Tu] },
      ],
    },
  ],
  readouts: ['unter'],
  scenarios: [
    { label: 'Folie 22', text: 'T₀ = 80 °C, Tᵘ = 4 °C, α = 0.2: nach 12 Schritten, also 2 Stunden, unter 10 °C.', params: { alpha: 0.2, T0: 80, Tu: 4, N: 18 } },
    { label: 'Folie 23: α = 0.2', params: { alpha: 0.2, T0: 80, Tu: 4, N: 10 } },
    { label: 'α = 1.5', text: 'Der Zeitschritt ist zu groß: die Temperatur springt über Tᵘ hinweg.', params: { alpha: 1.5, T0: 80, Tu: 4, N: 10 } },
    { label: 'α = 2', text: 'Die Temperatur springt zwischen 80 °C und −72 °C hin und her.', params: { alpha: 2, T0: 80, Tu: 4, N: 10 } },
  ],
})

// -------------------------------------------------------- Folie 25: veränderliche Wachstumsrate

const rate = defineApplet({
  id: 'v1b-rate',
  title: 'Veränderliche Wachstumsrate',
  summary: 'R(x) = r (1 − x/K)',
  chapter: 'I',
  model: closedForm({
    id: 'v1b-rate',
    params: {
      r: real('Wachstumsrate', { latex: 'r', min: 0, max: 3, step: 0.01, default: 0.5 }),
      K: real('Tragfähigkeit', { latex: 'K', min: 0.5, max: 20, step: 0.1, default: 5, limits: { min: 1e-6, reason: 'K steht im Nenner und muss positiv sein.' } }),
    },
    domain: (p) => [0, 1.5 * p.K],
    curves: { R: { label: 'R(x)', f: (x, p) => p.r * (1 - x / p.K) } },
  }),
  formulas: [{ label: 'Wachstumsrate', tex: String.raw`R(x) = {{r}}\left(1 - \frac{x}{{{K}}}\right)` }],
  plots: [
    {
      type: 'functionGraph',
      xLabel: 'x',
      yLabel: 'R(x)',
      drag: [
        { param: 'r', axis: 'y', at: (p) => [0, p.r], set: (_x, y) => ({ r: Math.max(0, y) }) },
        { param: 'K', axis: 'x', at: (p) => [p.K, 0], set: (x) => ({ K: Math.max(0.5, x) }) },
      ],
    },
  ],
  scenarios: [{ label: 'Folie 25', text: 'Bei x = K ist die Rate null, darüber negativ.', params: { r: 0.5, K: 5 } }],
})

// --------------------------------------------- Folie 27: Aktualisierungsfunktion, logistisch

const logistischF = defineApplet({
  id: 'v1b-logistisch-f',
  title: 'Aktualisierungsfunktion des logistischen Wachstums',
  summary: 'f(x) = (1 + r) x − r/K x²',
  chapter: 'I',
  model: closedForm({
    id: 'v1b-logistisch-f',
    params: {
      r: real('Wachstumsrate', { latex: 'r', min: 0, max: 3, step: 0.01, default: 0.5 }),
      K: real('Tragfähigkeit', { latex: 'K', min: 0.5, max: 10, step: 0.1, default: 5, limits: { min: 1e-6, reason: 'K steht im Nenner und muss positiv sein.' } }),
    },
    domain: (p) => [0, (1 + 1 / Math.max(p.r, 0.05)) * p.K * 1.07],
    curves: { f: { label: 'f', f: (x, p) => (1 + p.r) * x - (p.r / p.K) * x * x } },
    observables: ({ p }) => ({
      fK: quantity('f(K) = K', p.K, { digits: 3, marks: [{ kind: 'point', x: p.K, y: p.K, in: 'map' }] }),
    }),
  }),
  formulas: [{ label: 'Aktualisierungsfunktion', tex: String.raw`f(x) = (1 + {{r}})\,x - \frac{{{r}}}{{{K}}}\,x^2` }],
  plots: [
    {
      type: 'functionGraph',
      diagonal: true,
      xLabel: 'x',
      yLabel: 'f(x)',
      drag: [
        // f(K) = K: the capacity sits on the diagonal
        { param: 'K', axis: 'x', at: (p) => [p.K, p.K], set: (x) => ({ K: Math.max(0.5, x) }) },
        // f(K/2) = K/2 + r·K/4
        { param: 'r', label: String.raw`f(\tfrac{K}{2})`, axis: 'y', at: (p) => [p.K / 2, p.K / 2 + (p.r * p.K) / 4], set: (_x, y, p) => ({ r: Math.max(0, (4 * (y - p.K / 2)) / p.K) }) },
      ],
    },
  ],
  readouts: ['fK'],
  scenarios: [
    { label: 'Folie 27', text: 'r = 0.5, K = 5: f(K) = K auf der Diagonale.', params: { r: 0.5, K: 5 } },
    { label: 'r = 2', params: { r: 2, K: 5 } },
  ],
})

// ---------------------------------------------------------- Folien 29–30: Parameterstudie

const parameterstudie = defineApplet({
  ...logisticCobweb,
  id: 'v1b-parameterstudie',
  title: 'Parameterstudie',
  summary: 'y_{n+1} = a y_n (1 − y_n), y₀ = 0.1',
  chapter: 'I',
  scenarios: [
    { label: 'a = 2.8', text: 'Folie 29: y₀ = 0.1, 50 Schritte.', params: { a: 2.8, y0: 0.1, N: 50 } },
    { label: 'a = 3.2', params: { a: 3.2, y0: 0.1, N: 50 } },
    { label: 'a = 3.5', params: { a: 3.5, y0: 0.1, N: 50 } },
    { label: 'a = 3.9', params: { a: 3.9, y0: 0.1, N: 50 } },
  ],
})

// ----------------------------------------- Folien 30–32: Langzeitverhalten, Bifurkationsdiagramm

type Fenster = 'vier' | 'ganz' | 'zoom' | 'zoom2'
const FENSTER: Record<Fenster, { x: [number, number]; y: [number, number] }> = {
  vier: { x: [2.6, 4], y: [0, 1] },
  ganz: { x: [2.4, 4], y: [0, 1] },
  zoom: { x: [3.8, 3.9], y: [0, 1] },
  zoom2: { x: [3.85375, 3.85420], y: [0.495, 0.506] },
}
const VIER = [2.8, 3.2, 3.5, 3.9]
/** The values y_n for large n at a few a: after a transient, the next ones. */
const langzeit = (as: readonly number[]) => {
  const xs: number[] = []
  const ys: number[] = []
  for (const a of as) {
    let v = 0.1
    for (let k = 0; k < 500; k++) v = a * v * (1 - v)
    for (let k = 0; k < 300; k++) {
      v = a * v * (1 - v)
      xs.push(a)
      ys.push(v)
    }
  }
  return { x: Float64Array.from(xs), y: Float64Array.from(ys) }
}

const bifurkation = defineApplet({
  id: 'v1b-bifurkation',
  title: 'Langzeitverhalten und Bifurkationsdiagramm',
  summary: 'Welche Werte nimmt y_n an, wenn n groß ist?',
  chapter: 'I',
  model: iteration({
    id: 'v1b-bifurkation',
    params: {
      fenster: choice(
        'Ausschnitt',
        [
          { value: 'vier', label: 'vier Werte von a' },
          { value: 'ganz', label: '2.4 bis 4' },
          { value: 'zoom', label: '3.8 bis 3.9' },
          { value: 'zoom2', label: 'um 3.854' },
        ],
        'ganz',
      ),
      a: real('Wachstumsrate', { latex: 'a', min: 2.4, max: 4, step: 0.0001, default: 3.2 }),
      N: steps('Schritte', { latex: 'N', default: 50, max: 300 }),
    },
    start: () => 0.1,
    step: (y, p) => p.a * y * (1 - y),
    horizon: (p) => p.N,
    series: { id: 'y', label: 'y_n' },
    extraSeries: ({ p }) => {
      const w = FENSTER[p.fenster as Fenster]
      const d = p.fenster === 'vier' ? langzeit(VIER) : bifurcation(w.x[0], w.x[1], w.y[0], w.y[1])
      const out: Series[] = [
        { id: 'diagramm', label: 'y^*', name: 'Langzeitwerte', kind: 'discrete', x: d.x, y: d.y, role: 'primary', connect: false },
        { id: 'jetzt', label: 'a', name: 'gewählt', kind: 'continuous', x: Float64Array.of(p.a, p.a), y: Float64Array.of(w.y[0], w.y[1]), role: 'secondary' },
      ]
      // where one value becomes two (a = 3), and two become four (a = 1 + √6)
      if (p.fenster === 'ganz')
        for (const [i, a] of [3, 1 + Math.sqrt(6)].entries())
          out.push({ id: `grenze${i}`, label: '', kind: 'continuous', x: Float64Array.of(a, a), y: Float64Array.of(0, 1), role: 'reference', dash: [2, 3], legend: false })
      return out
    },
  }),
  horizon: 'N',
  formulas: [
    { label: 'Vorschrift', tex: String.raw`y_{n+1} = {{a}}{{*}}y_n\,(1 - y_n)` },
    { label: 'Start', tex: String.raw`y_0 = 0.1` },
    { label: 'Ausschnitt', tex: String.raw`{{fenster}}` },
  ],
  plots: [
    {
      type: 'scatter',
      series: ['diagramm', 'jetzt', 'grenze0', 'grenze1'],
      xLabel: 'a',
      yLabel: 'y^*',
      x: (p) => FENSTER[p.fenster as Fenster].x,
      y: (p) => FENSTER[p.fenster as Fenster].y,
      drag: [{ param: 'a', axis: 'x', at: (p) => [p.a, FENSTER[p.fenster as Fenster].y[1] * 0.96 + FENSTER[p.fenster as Fenster].y[0] * 0.04], set: (x) => ({ a: x }) }],
    },
    { type: 'timeSeriesDiscrete', series: ['y'], xLabel: 'n', yLabel: 'y_n', y: [0, 1] },
  ],
  scenarios: [
    { label: 'Folie 30', text: 'Die Werte für große n bei a = 2.8, 3.2, 3.5 und 3.9.', params: { fenster: 'vier', a: 3.2 } },
    { label: 'Folie 31', text: 'Das Bifurkationsdiagramm: ein Wert, zwei Werte, Chaos.', params: { fenster: 'ganz', a: 3.2 } },
    { label: 'Folie 32: Zoom', text: 'a von 3.8 bis 3.9: ein Fenster mit Periode 3.', params: { fenster: 'zoom', a: 3.84 } },
    { label: 'Folie 32: noch näher', text: 'Um a = 3.854: dasselbe Bild im Kleinen.', params: { fenster: 'zoom2', a: 3.8539 } },
  ],
})

// ---------------------------------------------- Folie 33: sensitive Abhängigkeit vom Anfangswert

const chaos = defineApplet({
  id: 'v1b-chaos',
  title: 'Sensitive Abhängigkeit vom Anfangswert',
  summary: 'a = 3.9, zwei fast gleiche Startwerte',
  chapter: 'I',
  model: iterationN({
    id: 'v1b-chaos',
    params: {
      a: real('Wachstumsrate', { latex: 'a', min: 0, max: 4, step: 0.01, default: 3.9 }),
      y0: real('Startwert', { latex: 'y_0', min: 0, max: 1, step: 0.0001, default: 0.2 }),
      d: real('Unterschied', { latex: '\\delta', min: 0, max: 0.01, step: 0.0001, default: 0.0001 }),
      N: steps('Schritte', { latex: 'N', default: 50, max: 300 }),
    },
    components: [
      { id: 'y', label: 'y_n', name: 'Startwert y₀', role: 'primary' },
      { id: 'z', label: 'z_n', name: 'Startwert y₀ + δ', role: 'secondary' },
    ],
    start: (p) => [p.y0, p.y0 + p.d],
    step: ([y, z], p) => [p.a * y * (1 - y), p.a * z * (1 - z)],
    horizon: (p) => p.N,
    observables: ({ x: [y, z] }) => {
      const n = y.findIndex((v, k) => Math.abs(v - z[k]) > 0.1)
      return {
        trennung: index('Abstand größer als 0.1 ab n', n < 0 ? null : n, { note: 'nicht im Zeitfenster', marks: n < 0 ? [] : [{ kind: 'time', t: n }] }),
        art: category('Die beiden Folgen', n < 0 ? 'bleiben beieinander' : 'laufen auseinander'),
      }
    },
  }),
  horizon: 'N',
  formulas: [
    { label: 'Vorschrift', tex: String.raw`y_{n+1} = {{a}}{{*}}y_n\,(1 - y_n)` },
    { label: 'Start', tex: String.raw`y_0 = {{#y0}}, \quad z_0 = y_0 + {{#d}}` },
  ],
  plots: [{ type: 'timeSeriesDiscrete', series: ['y', 'z'], xLabel: 'n', yLabel: 'y_n', y: [0, 1], drag: { param: 'y0', axis: 'y' } }],
  readouts: ['trennung', 'art'],
  scenarios: [
    { label: 'Folie 33', text: 'a = 3.9, y₀ = 0.2 und 0.2001.', params: { a: 3.9, y0: 0.2, d: 0.0001, N: 50 } },
    { label: 'a = 2.8', text: 'Ohne Chaos laufen beide zum selben Fixpunkt.', params: { a: 2.8, y0: 0.2, d: 0.0001, N: 50 } },
    { label: 'noch näher', text: 'Startwerte nur 0.000001 auseinander.', params: { a: 3.9, y0: 0.2, d: 0.000001, N: 50 } },
  ],
})

export const kapitel1b: AppletModule<any>[] = [heronV, arithmetisch, geometrisch, wettlauf, linear, abkuehlung, rate, logistischF, parameterstudie, bifurkation, chaos]
