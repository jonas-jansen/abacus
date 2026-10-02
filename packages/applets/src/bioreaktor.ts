// Bacterial growth in a bioreactor (slides IV 9, 27–28): b' = K(n) b − D b,
// n' = −ν K(n) b − D n + D n_in with Monod kinetics K(n) = k_max n / (k₅₀ + n).
// Equilibria: washout (b = 0, n = n_in), and — if the bacteria grow faster than they are
// washed out at n_in — n* = D k₅₀ / (k_max − D), b* = (n_in − n*)/ν. Too high a flow rate D
// washes the culture out.
// b is counted in 10¹¹ bacteria per litre (as on the slides' axis), so b and n share a plot
// and ν = 0,5·10⁻¹¹ g per bacterium becomes 0,5 g per 10¹¹ bacteria.

import { classify, eigenReadout, jacobian, category, list, ode, real, type Mark } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

type P = { D: number; nin: number; nu: number; kmax: number; k50: number; b0: number; n0: number }

const K = (n: number, p: P) => (p.kmax * n) / (p.k50 + n)
const rhs = ([b, n]: ArrayLike<number> & Iterable<number>, p: P) => [K(n, p) * b - p.D * b, -p.nu * K(n, p) * b - p.D * n + p.D * p.nin]

/** The equilibria: washout, and the culture if it can hold (n* < n_in). */
function gleichgewichte(p: P) {
  const out: { x: [number, number]; name: string }[] = [{ x: [0, p.nin], name: 'Auswaschen' }]
  if (p.kmax > p.D) {
    const n = (p.D * p.k50) / (p.kmax - p.D)
    if (n < p.nin) out.push({ x: [(p.nin - n) / p.nu, n], name: 'Kultur' })
  }
  return out.map((e) => {
    const J = jacobian((y) => rhs(y, p), e.x)
    const tr = J[0][0] + J[1][1]
    const det = J[0][0] * J[1][1] - J[0][1] * J[1][0]
    return { ...e, J, typ: classify(tr, det), stabil: tr < 0 && det > 0 }
  })
}

const model = ode({
  id: 'bioreaktor',
  params: {
    D: real('Durchflussrate', { latex: 'D', min: 0, max: 1.5, step: 0.01, default: 0.1, unit: '1/h', limits: { min: 0, reason: 'Die Durchflussrate ist nicht negativ.' } }),
    nin: real('Nährstoff im Zufluss', { latex: 'n_{\\text{in}}', min: 0, max: 30, step: 0.1, default: 5, unit: 'g/l' }),
    kmax: real('maximale Wachstumsrate', { latex: 'k_{\\max}', min: 0, max: 3, step: 0.01, default: 1.4, unit: '1/h' }),
    k50: real('Halbsättigung', { latex: 'k_{50}', min: 0.1, max: 30, step: 0.1, default: 12, unit: 'g/l', limits: { min: 1e-6, reason: 'k₅₀ steht im Nenner.' } }),
    nu: real('Ertragskoeffizient', { latex: '\\nu', min: 0.05, max: 2, step: 0.01, default: 0.5, unit: 'g/10¹¹', limits: { min: 1e-6, reason: 'ν muss positiv sein.' } }),
    b0: real('Bakterien am Anfang', { latex: 'b_0', min: 0, max: 30, step: 0.1, default: 1.4, unit: '10¹¹/l' }),
    n0: real('Nährstoff am Anfang', { latex: 'n_0', min: 0, max: 30, step: 0.1, default: 12, unit: 'g/l' }),
    T: real('Zeitfenster', { latex: 'T', min: 5, max: 200, step: 1, default: 50, unit: 'h', limits: { min: 0.1, reason: 'Das Zeitfenster muss positiv sein.' } }),
  },
  components: [
    { id: 'b', label: 'b(t)', name: 'Bakterien', role: 'primary' },
    { id: 'n', label: 'n(t)', name: 'Nährstoff', role: 'secondary' },
  ],
  start: (p) => [p.b0, p.n0],
  rhs: (_t, y, p) => rhs(y, p),
  tEnd: (p) => p.T,
  observables: ({ p }) => {
    const eq = gleichgewichte(p)
    const kultur = eq.find((e) => e.name === 'Kultur')
    const ziel = eq.find((e) => e.stabil) ?? eq[0]
    const mark = (e: (typeof eq)[number]): Mark => ({ kind: 'point', x: e.x[0], y: e.x[1], in: 'phase' })
    return {
      kultur: category('Die Kultur', kultur?.stabil ? 'hält sich' : 'wird ausgewaschen', {
        note: kultur ? undefined : 'bei diesem Durchfluss wachsen die Bakterien langsamer, als sie hinausgespült werden',
        marks: [mark(ziel)],
      }),
      gleichgewicht: list('Gleichgewicht $(b^*, n^*)$', ziel.x, { form: 'vector', marks: [mark(ziel)] }),
      typ: category('Typ', ziel.typ, { marks: [mark(ziel)] }),
      eigenwerte: eigenReadout(ziel.J[0][0], ziel.J[0][1], ziel.J[1][0], ziel.J[1][1], { at: ziel.x }),
    }
  },
})

export default defineApplet({
  id: 'bioreaktor',
  model,
  horizon: 'T',
  formulas: [
    {
      label: 'System',
      tex: String.raw`b' = \frac{{{kmax}}\,n}{{{k50}} + n}\,b - {{D}}\,b \\ n' = -{{nu}}\,\frac{{{kmax}}\,n}{{{k50}} + n}\,b - {{D}}\,n + {{D}}{{*}}{{nin}}`,
    },
    { label: 'Start', tex: String.raw`b(0) = {{#b0}} \\ n(0) = {{#n0}}` },
  ],
  plots: [
    {
      type: 'timeSeriesContinuous',
      xLabel: 't',
      yLabel: 'b, n',
      drag: [
        { param: 'b0', axis: 'y' },
        { param: 'n0', axis: 'y' },
      ],
    },
    {
      type: 'phasePlane',
      xSeries: 'b',
      ySeries: 'n',
      title: 'Phasenebene',
      xLabel: 'b',
      yLabel: 'n',
      x: (p) => [0, Math.max(20, 1.2 * p.b0, (1.2 * p.nin) / p.nu)],
      y: (p) => [0, 1.15 * Math.max(p.nin, p.n0)],
      field: true,
      nullclines: true,
      bahnen: true,
      drag: { param: 'b0', axis: 'xy', at: (p: { b0: number; n0: number }) => [p.b0, p.n0] as const, set: (x, y) => ({ b0: x, n0: y }), also: ['n0'], label: '(b_0, n_0)' },
    },
  ],
  layout: { main: ['D', 'nin', 'kmax'] },
  readouts: ['kultur', 'gleichgewicht', 'typ', 'eigenwerte'],
  scenarios: [
    { label: 'Folie 27', text: 'D = 0,1/h: die Kultur stellt sich auf ein Gleichgewicht ein', params: {} },
    { label: 'knapp', text: 'D = 0,4/h: knapp unter der Grenze k_max n_in/(k₅₀ + n_in) ≈ 0,41/h', params: { D: 0.4 } },
    { label: 'Auswaschen', text: 'D = 0,5/h: schneller hinausgespült als nachgewachsen', params: { D: 0.5 } },
  ],
})
