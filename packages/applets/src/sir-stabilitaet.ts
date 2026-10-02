// SIR model, second part (slides II 44–58): equilibria and their stability. Disease-free
// x*_a = (N, 0) and endemic x*_b; the Jacobian at each decides by its spectral radius. With
// R = βN/(γ + α): x*_a is stable for R < 1, x*_b for 1 < R ≤ 2/α. At the start, x₁ ≈ N and
// x₂ grows like (1 + (α + γ)(R − 1))ⁿ — a straight line on a log axis (II 56–57). The new
// infections per step, β x₁ x₂, peak earlier and higher the larger R is (II 58).

import { equilibria2, formatNumber, iterationN, klasse, liste, maximum, real, schritte, spectralRadius, zahl, type Mark } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

const N = 100_000
type P = { beta: number; gamma: number; alpha: number; I0: number }
const f = ([s, i]: ArrayLike<number> & Iterable<number>, p: P) => [s - p.beta * s * i + p.alpha * (N - s), (1 - p.gamma - p.alpha) * i + p.beta * s * i]

const model = iterationN({
  id: 'sir-stabilitaet',
  params: {
    beta: real('Ansteckungsrate', { latex: '\\beta', min: 0, max: 1e-5, step: 1e-8, default: 7.6e-6 }),
    gamma: real('Genesungsrate', { latex: '\\gamma', min: 0, max: 1, step: 0.01, default: 0.1 }),
    alpha: real('Erneuerungsrate', { latex: '\\alpha', min: 0, max: 1, step: 0.01, default: 0.1 }),
    I0: real('anfangs Infizierte', { latex: 'x_2(0)', min: 0, max: 50_000, step: 1, default: 1, limits: { min: 0, max: N, reason: 'Es gibt nur 100 000 Menschen.' } }),
    T: schritte('Schritte', { latex: 'n_{\\max}', default: 80, max: 300 }),
  },
  normalize: (p) => (p.alpha + p.gamma > 1 ? { ...p, gamma: 1 - p.alpha } : p),
  constraintNote: 'α + γ ≤ 1',
  components: [
    { id: 'S', label: 'x_1', name: 'Gesunde', role: 'primary' },
    { id: 'I', label: 'x_2', name: 'Infizierte', role: 'secondary' },
  ],
  start: (p) => [N - p.I0, p.I0],
  step: (x, p) => f(x, p),
  horizon: (p) => p.T,
  extraSeries: ({ p, n, x: [S, I] }) => {
    const R = (p.beta * N) / (p.gamma + p.alpha)
    const q = 1 + (p.alpha + p.gamma) * (R - 1)
    let spitze = 0
    for (const v of I) spitze = Math.max(spitze, v)
    return [
      { id: 'neu', label: '\\beta\\, x_1 x_2', name: 'Neuinfektionen je Schritt', kind: 'discrete', x: n, y: n.map((_, k) => p.beta * S[k] * I[k]), role: 'tertiary' },
      // the initial phase with x₁ ≈ N: geometric growth by q per step. It describes only the
      // start; it ends where it leaves the picture (above the most infected), or it would
      // stretch a linear axis to 10³² and flatten the real curve.
      { id: 'anfang', label: 'x_2(0)\\, q^n', name: 'Anfangsphase', kind: 'continuous', x: n, y: n.map((k) => (p.I0 * q ** k <= 1.2 * spitze ? p.I0 * q ** k : NaN)), role: 'reference' },
    ]
  },
  observables: ({ p, x: [, I] }) => {
    const R = (p.beta * N) / (p.gamma + p.alpha)
    const eq = equilibria2((y) => f(y, p), [[0, N * 1.001], [0, N]], 'map')
    const a = eq.find((e) => Math.abs(e.x[1]) < 1e-6 * N)
    const b = eq.find((e) => e.x[1] > 1e-6 * N)
    const mark = (x: readonly [number, number]): Mark => ({ kind: 'value', v: x[1] })
    const peak = maximum(I)
    const stab = (e: (typeof eq)[number]) => `${e.stable ? 'stabil' : 'instabil'}, ρ(J) = ${formatNumber(spectralRadius(e.eigen), 3)}`
    return {
      R: zahl('Basisreproduktionszahl $R = \\beta N/(\\gamma + \\alpha)$', R, { digits: 3 }),
      a: klasse('krankheitsfrei $x^*_a = (N, 0)$', a ? stab(a) : null, { marks: a ? [mark(a.x)] : [] }),
      b: klasse('endemisch $x^*_b$', b ? stab(b) : null, {
        note: b ? undefined : 'gibt es nur für R > 1',
        marks: b ? [mark(b.x)] : [],
      }),
      bStand: liste('endemischer Zustand $\\mathbf{x}^*_b$', b ? b.x : null, { form: 'vektor', marks: b ? [mark(b.x)] : [] }),
      bedingung: klasse('Bedingung $1 < R \\le 2/\\alpha$', R > 1 && R <= 2 / p.alpha ? 'erfüllt' : 'nicht erfüllt'),
      spitze: zahl('meiste Infizierte', peak?.value ?? null, { digits: 5, marks: peak ? [{ kind: 'point', x: peak.index, y: peak.value, in: 'time' }] : [] }),
    }
  },
})

export default defineApplet({
  id: 'sir-stabilitaet',
  model,
  horizont: 'T',
  formeln: [
    { label: 'System', tex: String.raw`x_1(n+1) = x_1(n) - {{beta}}{{*}}x_1(n)\,x_2(n) + {{alpha}}\,\bigl(N - x_1(n)\bigr) \\ x_2(n+1) = (1 - {{gamma}} - {{alpha}})\,x_2(n) + {{beta}}{{*}}x_1(n)\,x_2(n)` },
    { label: 'Start', tex: String.raw`x_1(0) = N - x_2(0) \\ x_2(0) = {{#I0}}` },
    { label: 'Anfangsphase', tex: String.raw`q = 1 + (\alpha + \gamma)(R - 1)` },
  ],
  plots: [
    {
      type: 'timeSeriesDiscrete',
      series: ['I', 'anfang'],
      title: 'Infizierte',
      xLabel: 'n',
      yLabel: 'x_2(n)',
      yScale: 'log',
      yLogRange: [0.5, 2e5],
      logToggle: true,
      logHilfe: 'Am Anfang ist fast jeder gesund, x₁ ≈ N: dann wächst x₂ in jedem Schritt um denselben Faktor q – auf der log-Achse eine Gerade.',
      drag: { param: 'I0', axis: 'y' },
    },
    { type: 'timeSeriesDiscrete', series: ['neu'], title: 'Neuinfektionen', xLabel: 'n', yLabel: '\\beta x_1 x_2' },
  ],
  layout: { main: ['beta', 'gamma', 'alpha'] },
  anzeige: ['R', 'a', 'b', 'bStand', 'bedingung', 'spitze'],
  szenarien: [
    { label: 'Szenario A', text: 'β = 1,2·10⁻⁶, x(0) = (70 000, 30 000): R = 0,6, die Krankheit verschwindet', params: { beta: 1.2e-6, gamma: 0.1, alpha: 0.1, I0: 30_000 } },
    { label: 'Szenario B', text: 'β = 7,6·10⁻⁶, x(0) = (99 999, 1): R = 3,8, endemisch', params: { beta: 7.6e-6, gamma: 0.1, alpha: 0.1, I0: 1 } },
  ],
})
