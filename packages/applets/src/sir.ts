// MATLAB: app_SIR — discrete epidemic model with renewal (α), recovery (γ) and infection (β):
//   x₁⁺ = x₁ − β x₁ x₂ + α (N − x₁),   x₂⁺ = (1 − γ − α) x₂ + β x₁ x₂,
// population N = 100 000. Coupling α + γ ≤ 1 (else x₂ could turn negative).

import { index, iterationN, klasse, liste, maximum, real, schritte, zahl } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

const N = 100_000

const model = iterationN({
  id: 'sir',
  params: {
    beta: real('Ansteckungsrate', { latex: '\\beta', min: 0, max: 1e-5, step: 1e-8, default: 5e-6 }),
    gamma: real('Genesungsrate', { latex: '\\gamma', min: 0, max: 1, step: 0.01, default: 0.1 }),
    alpha: real('Erneuerungsrate', { latex: '\\alpha', min: 0, max: 1, step: 0.01, default: 0.1 }),
    I0: real('anfangs Infizierte', { latex: 'x_2(0)', min: 0, max: 1000, step: 1, default: 1, limits: { min: 0, max: N, reason: 'Es gibt nur 100 000 Menschen.' } }),
    T: schritte('Schritte', { latex: 'n_{\\max}', default: 80, max: 300 }),
  },
  normalize: (p) => (p.alpha + p.gamma > 1 ? { ...p, gamma: 1 - p.alpha } : p),
  constraintNote: 'α + γ ≤ 1',
  components: [
    { id: 'S', label: 'x_1', name: 'Gesunde', role: 'primary' },
    { id: 'I', label: 'x_2', name: 'Infizierte', role: 'secondary' },
  ],
  start: (p) => [N - p.I0, p.I0],
  step: ([s, i], p) => [s - p.beta * s * i + p.alpha * (N - s), (1 - p.gamma - p.alpha) * i + p.beta * s * i],
  horizon: (p) => p.T,
  observables: ({ p, x: [S, I] }) => {
    const R = (p.beta * (N - p.I0)) / (p.gamma + p.alpha)
    const sStar = (p.gamma + p.alpha) / p.beta
    const endemic = p.beta > 0 && sStar < N
    const eq = endemic ? [sStar, (p.alpha * (N - sStar)) / (p.gamma + p.alpha)] : [N, 0]
    const peak = maximum(I)
    return {
      reproduktion: zahl('Reproduktionszahl $\\beta x_1(0)/(\\gamma + \\alpha)$', R, { digits: 3 }),
      ausbruch: klasse('Epidemie', R > 1 ? 'bricht aus' : 'stirbt aus'),
      gleichgewicht: liste('Gleichgewicht $(x_1^*, x_2^*)$', eq, {
        marks: [
          { kind: 'value', v: eq[0], item: 0 },
          { kind: 'value', v: eq[1], item: 1 },
          { kind: 'point', x: eq[0], y: eq[1], in: 'phase' },
        ],
      }),
      spitze: zahl('höchstens infiziert', peak?.value ?? null, {
        digits: 5,
        marks: peak ? [{ kind: 'point', x: peak.index, y: peak.value, in: 'time' }] : [],
      }),
      spitzeBei: index('Spitze bei $n$', peak?.index ?? null, { marks: peak ? [{ kind: 'time', t: peak.index }] : [] }),
    }
  },
})

export default defineApplet({
  id: 'sir',
  titel: 'Epidemie-Modell',
  kurz: 'Gesunde stecken sich an, Kranke genesen – wann bricht eine Epidemie aus?',
  kapitel: 'II',
  folien: '40–58',
  model,
  horizont: 'T',
  formeln: [
    { label: 'System', tex: String.raw`x_1(n+1) = x_1(n) - {{beta}}{{*}}x_1(n)\,x_2(n) + {{alpha}}\,\bigl(100\,000 - x_1(n)\bigr) \\ x_2(n+1) = (1 - {{gamma}} - {{alpha}})\,x_2(n) + {{beta}}{{*}}x_1(n)\,x_2(n)` },
    { label: 'Start', tex: String.raw`x_1(0) = 100\,000 - x_2(0) \\ x_2(0) = {{#I0}}` },
  ],
  plots: [
    {
      type: 'timeSeriesDiscrete',
      xLabel: 'n',
      yLabel: 'x_1, x_2',
      logToggle: true,
      logHilfe: 'Am Anfang wächst die Zahl der Infizierten in jedem Schritt um denselben Faktor – auf dieser Achse eine Gerade. Wo sie abknickt, gehen die Gesunden zur Neige.',
      y: [0, N * 1.02],
      drag: [{ param: 'I0', axis: 'y', at: (p) => [0, p.I0], set: (_x, y) => ({ I0: Math.round(Math.max(0, y)) }) }],
    },
    {
      type: 'phasePlane',
      xSeries: 'S',
      ySeries: 'I',
      xLabel: 'x_1',
      yLabel: 'x_2',
      x: [0, N],
      y: 'auto',
      // x₁* = (γ + α)/β: where the healthy settle is set by the infection rate
      drag: [
        {
        param: 'beta',
        label: 'x^*',
        axis: 'x',
        at: (p) => {
          const s = (p.gamma + p.alpha) / p.beta
          return p.beta > 0 && s < N ? [s, (p.alpha * (N - s)) / (p.gamma + p.alpha)] : null
        },
        set: (x, _y, p) => ({ beta: (p.gamma + p.alpha) / Math.max(1, x) }),
        },
      ],
    },
  ],
  layout: { main: ['beta', 'gamma', 'alpha'] },
  anzeige: ['reproduktion', 'ausbruch', 'gleichgewicht', 'spitze', 'spitzeBei'],
})
