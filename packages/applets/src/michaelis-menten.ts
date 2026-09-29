// MATLAB: app_MM — enzyme kinetics by the law of mass action. Substrate S binds to enzyme E
// (rate k₁), the complex C falls apart (k₂) or makes product P (k₃):
//   S' = −k₁SE + k₂C,  E' = −k₁SE + (k₂ + k₃)C,  C' = k₁SE − (k₂ + k₃)C,  P' = k₃C.
// E + C and S + C + P stay constant. With fast binding (large k₁) the system is stiff: the
// Rosenbrock solver handles it where an explicit method would crawl.

import { events, ode, real, zahl } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

const model = ode({
  id: 'michaelis-menten',
  params: {
    k1: real('Bindungsrate', { latex: 'k_1', min: 0.01, max: 1000, step: 0.01, default: 1, scale: 'log', unit: 'µM⁻¹s⁻¹' }),
    k2: real('Zerfallsrate', { latex: 'k_2', min: 0, max: 0.02, step: 0.0001, default: 0.0001, unit: 's⁻¹' }),
    k3: real('Umsatzrate', { latex: 'k_3', min: 0, max: 0.2, step: 0.001, default: 0.1, unit: 's⁻¹' }),
    S0: real('Substrat', { latex: 'S_0', min: 0, max: 1, step: 0.01, default: 0.5, unit: 'µM' }),
    E0: real('Enzym', { latex: 'E_0', min: 0, max: 1, step: 0.01, default: 0.2, unit: 'µM' }),
    T: real('Zeitfenster', { latex: 'T', min: 5, max: 200, step: 1, default: 50, unit: 's', limits: { min: 0.01, reason: 'Das Zeitfenster muss positiv sein.' } }),
  },
  components: [
    { id: 'S', label: 'S', role: 'primary' },
    { id: 'E', label: 'E', role: 'reference' },
    { id: 'C', label: 'C', role: 'tertiary' },
    { id: 'P', label: 'P', role: 'secondary' },
  ],
  start: (p) => [p.S0, p.E0, 0, 0],
  rhs: (_t, [S, E, C], p) => {
    const bind = p.k1 * S * E
    return [-bind + p.k2 * C, -bind + (p.k2 + p.k3) * C, bind - (p.k2 + p.k3) * C, p.k3 * C]
  },
  tEnd: (p) => p.T,
  stiff: true,
  tol: 1e-5,
  observables: ({ p, sol }) => {
    const half = events(sol, (_t, y) => y[3] - p.S0 / 2)[0] ?? null
    const KM = p.k1 > 0 ? (p.k2 + p.k3) / p.k1 : null
    return {
      halb: zahl('halber Umsatz nach', half, {
        note: 'nicht im Zeitfenster',
        marks: half === null ? [] : [{ kind: 'time', t: half }, { kind: 'point', x: half, y: p.S0 / 2, in: 'time' }],
      }),
      KM: zahl('Michaelis-Konstante $K_M$', KM, { digits: 3 }),
      vmax: zahl('Maximalrate $v_{max}$', p.k3 * p.E0, { digits: 3 }),
      erhaltung: zahl('$E + C$ bleibt', p.E0, { marks: [{ kind: 'value', v: p.E0 }] }),
    }
  },
})

export default defineApplet({
  id: 'michaelis-menten',
  titel: 'Enzymkinetik nach Michaelis und Menten',
  kurz: 'Substrat wird über einen Komplex zu Produkt – vier Stoffe, zwei Erhaltungsgrößen.',
  kapitel: 'IV',
  folien: '23–28',
  model,
  horizont: 'T',
  formeln: [
    { label: 'System', tex: String.raw`S' = -{{k1}}{{*}}S\,E + {{k2}}{{*}}C \\ E' = -{{k1}}{{*}}S\,E + ({{k2}} + {{k3}})\,C \\ C' = {{k1}}{{*}}S\,E - ({{k2}} + {{k3}})\,C \\ P' = {{k3}}{{*}}C` },
    { label: 'Start', tex: String.raw`S(0) = {{#S0}} \\ E(0) = {{#E0}}` },
  ],
  plots: [
    {
      type: 'timeSeriesContinuous',
      xLabel: 't',
      yLabel: 'c',
      y: (p) => [0, Math.max(p.S0, p.E0) * 1.08 || 1],
      drag: [
        { param: 'S0', axis: 'y' },
        { param: 'E0', axis: 'y' },
      ],
    },
  ],
  layout: { main: ['k1', 'k2', 'k3'] },
  anzeige: ['halb', 'KM', 'vmax', 'erhaltung'],
})
