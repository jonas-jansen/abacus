// Cancer model with three groups (slides II 19–25): healthy x₁, mildly ill x₂, severely ill x₃.
// Each year a fraction p of the healthy fall mildly ill; a fraction h of the mildly ill are
// cured, the rest become severely ill; a fraction s of the severely ill improve. Every column
// of A sums to 1: nobody is lost, N = x₁ + x₂ + x₃ is conserved (II 24), λ = 1 is an
// eigenvalue, and the sequence approaches the stationary state — the eigenvector to λ = 1.

import { eigenvalues, eigenvalueNames, eigenvalueTexts, iterationN, list, real, steps, quantity } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

type P = { p: number; h: number; s: number; N: number }
const anteil = (label: string, latex: string, def: number) => real(label, { latex, min: 0, max: 1, step: 0.001, default: def, limits: { min: 0, max: 1, reason: 'Ein Bruchteil liegt zwischen 0 und 1.' } })

const matrix = (p: P) => [
  [1 - p.p, p.h, 0],
  [p.p, 0, p.s],
  [0, 1 - p.h, 1 - p.s],
]

/** The stationary state: A x = x with x₁ + x₂ + x₃ = N. */
function stationaer(p: P): [number, number, number] | null {
  // p x₁ = h x₂ and s x₃ = (1 − h) x₂
  if (p.h === 0 || p.s === 0) return null
  const x2 = p.p / p.h
  const x3 = ((1 - p.h) * x2) / p.s
  const sum = 1 + x2 + x3
  return [p.N / sum, (x2 * p.N) / sum, (x3 * p.N) / sum]
}

const model = iterationN({
  id: 'krebs',
  params: {
    p: anteil('erkranken leicht (pro Jahr)', 'p', 0.003),
    h: anteil('leicht Erkrankte gesunden', 'h', 0.6),
    s: anteil('schwer Erkrankte bessern sich', 's', 0.35),
    N: real('Bevölkerung', { latex: 'N', min: 1000, max: 1_000_000, step: 1000, default: 100_000, limits: { min: 0, reason: 'Eine Anzahl ist nicht negativ.' } }),
    T: steps('Jahre', { latex: 'n_{\\max}', default: 60, max: 500 }),
  },
  components: [
    { id: 'x1', label: 'x_1', name: 'gesund', role: 'primary' },
    { id: 'x2', label: 'x_2', name: 'leicht erkrankt', role: 'secondary' },
    { id: 'x3', label: 'x_3', name: 'schwer erkrankt', role: 'tertiary' },
  ],
  start: (p) => [p.N, 0, 0],
  step: ([a, b, c], p) => [(1 - p.p) * a + p.h * b, p.p * a + p.s * c, (1 - p.h) * b + (1 - p.s) * c],
  horizon: (p) => p.T,
  extraSeries: ({ n, x }) => [
    { id: 'summe', label: 'x_1 + x_2 + x_3', name: 'erhalten', kind: 'discrete', x: n, y: n.map((_, i) => x[0][i] + x[1][i] + x[2][i]), role: 'reference' },
  ],
  observables: ({ p, x }) => {
    const st = stationaer(p)
    const ls = eigenvalues(matrix(p))
    const last = x[0].length - 1
    return {
      stationaer: list('stationärer Zustand $\\mathbf{x}^*$', st, {
        form: 'vector',
        digits: 5,
        marks: st ? st.map((v, item) => ({ kind: 'value' as const, v, item })) : [],
        note: st ? undefined : 'für h = 0 oder s = 0 sammeln sich alle in einer Gruppe',
      }),
      summe: quantity('$x_1 + x_2 + x_3$ bei $n_{\\max}$', x[0][last] + x[1][last] + x[2][last], { digits: 7 }),
      eigenwerte: list('Eigenwerte von $A$', eigenvalueTexts(ls), { names: eigenvalueNames(ls) }),
    }
  },
})

export default defineApplet({
  id: 'krebs',
  model,
  horizon: 'T',
  formulas: [
    {
      label: 'Modell',
      tex: String.raw`\mathbf{x}(n+1) = \begin{pmatrix} 1 - {{p}} & {{h}} & 0 \\ {{p}} & 0 & {{s}} \\ 0 & 1 - {{h}} & 1 - {{s}} \end{pmatrix} \mathbf{x}(n)`,
    },
    { label: 'Start', tex: String.raw`\mathbf{x}(0) = \begin{pmatrix} {{#N}} \\ 0 \\ 0 \end{pmatrix}` },
    { label: 'Erhaltung', tex: String.raw`x_1 + x_2 + x_3 = N` },
  ],
  plots: [
    { type: 'timeSeriesDiscrete', series: ['x1', 'summe'], title: 'Gesunde', xLabel: 'n', yLabel: 'x_1(n)' },
    { type: 'timeSeriesDiscrete', series: ['x2', 'x3'], title: 'Erkrankte', xLabel: 'n', yLabel: 'x_2, x_3' },
  ],
  readouts: ['stationaer', 'summe', 'eigenwerte'],
  scenarios: [
    { label: 'Folie 20', text: '0,3 % erkranken, 60 % gesunden, 35 % bessern sich', params: {} },
    { label: 'bessere Behandlung', text: '80 % der leicht Erkrankten gesunden', params: { h: 0.8 } },
  ],
})
