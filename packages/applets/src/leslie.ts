// Leslie model with three age classes (slides II 26–37): x(n+1) = L x(n), births b_i in the
// first row, survival s_i below the diagonal. The spectral radius ρ(L) decides: the
// population dies out for ρ < 1 and grows for ρ > 1 (II 36). The slides' example
// (b₃ = 9, s₁ = 0.1, s₂ = 0.6) has three eigenvalues of the same modulus 3/∛50 < 1: it dies
// out, and its age structure keeps cycling with period 3 instead of settling.

import { eigenvalues, eigenvalueNames, eigenvalueTexts, iterationN, category, list, real, steps, spectralRadiusOf, quantity } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

type P = { b1: number; b2: number; b3: number; s1: number; s2: number; x1: number; x2: number; x3: number }

const leslie = (p: P) => [
  [p.b1, p.b2, p.b3],
  [p.s1, 0, 0],
  [0, p.s2, 0],
]

const geburt = (label: string, latex: string, def: number) => real(label, { latex, min: 0, max: 20, step: 0.1, default: def, limits: { min: 0, reason: 'Geburtenraten sind nicht negativ.' } })
const ueberleben = (label: string, latex: string, def: number) => real(label, { latex, min: 0, max: 1, step: 0.01, default: def, limits: { min: 0, max: 1, reason: 'Ein Bruchteil liegt zwischen 0 und 1.' } })
const start = (label: string, latex: string, def: number) => real(label, { latex, min: 0, max: 2000, step: 10, default: def, limits: { min: 0, reason: 'Eine Anzahl ist nicht negativ.' } })

const model = iterationN({
  id: 'leslie',
  params: {
    b1: geburt('Nachkommen Klasse 1', 'b_1', 0),
    b2: geburt('Nachkommen Klasse 2', 'b_2', 0),
    b3: geburt('Nachkommen Klasse 3', 'b_3', 9),
    s1: ueberleben('Überleben 1 → 2', 's_1', 0.1),
    s2: ueberleben('Überleben 2 → 3', 's_2', 0.6),
    x1: start('Anfang Klasse 1', 'x_1(0)', 0),
    x2: start('Anfang Klasse 2', 'x_2(0)', 0),
    x3: start('Anfang Klasse 3', 'x_3(0)', 1000),
    N: steps('Schritte', { latex: 'N', default: 30, max: 200 }),
  },
  components: [
    { id: 'x1', label: 'x_1', name: 'jung', role: 'primary' },
    { id: 'x2', label: 'x_2', name: 'mittel', role: 'secondary' },
    { id: 'x3', label: 'x_3', name: 'alt', role: 'tertiary' },
  ],
  start: (p) => [p.x1, p.x2, p.x3],
  step: ([a, b, c], p) => [p.b1 * a + p.b2 * b + p.b3 * c, p.s1 * a, p.s2 * b],
  horizon: (p) => p.N,
  extraSeries: ({ n, x }) => [
    { id: 'gesamt', label: 'x_1 + x_2 + x_3', name: 'gesamt', kind: 'discrete', x: n, y: n.map((_, i) => x[0][i] + x[1][i] + x[2][i]), role: 'reference' },
  ],
  observables: ({ p, x }) => {
    const L = leslie(p)
    const ls = eigenvalues(L)
    const rho = spectralRadiusOf(L)
    const last = x[0].length - 1
    const total = x[0][last] + x[1][last] + x[2][last]
    return {
      rho: quantity('Spektralradius $\\rho(L)$', rho, { digits: 4 }),
      zukunft: category('Die Population', rho < 1 - 1e-9 ? 'stirbt aus' : rho > 1 + 1e-9 ? 'wächst' : 'bleibt beschränkt'),
      eigenwerte: list('Eigenwerte', eigenvalueTexts(ls), { names: eigenvalueNames(ls) }),
      gesamt: quantity('Gesamtzahl $x_1 + x_2 + x_3$ bei $N$', total, { digits: 4, marks: [{ kind: 'time', t: last }] }),
    }
  },
})

export default defineApplet({
  id: 'leslie',
  model,
  horizon: 'N',
  formulas: [
    {
      label: 'Modell',
      tex: String.raw`\mathbf{x}(n+1) = \begin{pmatrix} {{b1}} & {{b2}} & {{b3}} \\ {{s1}} & 0 & 0 \\ 0 & {{s2}} & 0 \end{pmatrix} \mathbf{x}(n)`,
    },
    { label: 'Start', tex: String.raw`\mathbf{x}(0) = \begin{pmatrix} {{#x1}} \\ {{#x2}} \\ {{#x3}} \end{pmatrix}` },
  ],
  plots: [
    {
      type: 'timeSeriesDiscrete',
      series: ['x1', 'x2', 'x3', 'gesamt'],
      xLabel: 'n',
      yLabel: 'x_i(n)',
      logToggle: true,
      logHilfe: 'Wachsen oder schrumpfen alle Klassen am Ende um denselben Faktor ρ pro Schritt, werden die Kurven hier parallele Geraden.',
    },
    { type: 'bars', series: ['x1', 'x2', 'x3'], share: true, title: 'Altersstruktur bei n', xLabel: 'i', yLabel: 'Anteil', y: [0, 1] },
  ],
  layout: { main: ['b3', 's1', 's2'] },
  readouts: ['rho', 'zukunft', 'eigenwerte', 'gesamt'],
  scenarios: [
    { label: 'Folie 29', text: 'b₃ = 9, s₁ = 0.1, s₂ = 0.6: stirbt aus, die Altersstruktur kreist mit Periode 3', params: {} },
    { label: 'wächst', text: 'b₃ = 20: ρ = ∛1.2 > 1', params: { b3: 20 } },
    { label: 'stabile Struktur', text: 'auch die mittlere Klasse bekommt Nachwuchs: die Anteile stellen sich ein', params: { b2: 4, b3: 9 } },
  ],
})
