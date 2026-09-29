// MATLAB: app_log_IVP — logistic growth x' = r·x·(1 − x/K), x(0) = x₀, in closed form.
// Build order #2: closed form, three coupled parameters, continuous curve, responsive frame.

import { closedForm, real, zahl } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

/** x(t) = K·x₀ / (x₀ + (K − x₀)·e^(−rt)) */
const logistic = (t: number, r: number, K: number, x0: number) => (K * x0) / (x0 + (K - x0) * Math.exp(-r * t))

const model = closedForm({
  id: 'log-ivp',
  params: {
    r: real('Wachstumsrate', { latex: 'r', min: 0.05, max: 3, step: 0.01, default: 0.8 }),
    K: real('Kapazität', { latex: 'K', min: 1, max: 100, step: 1, default: 50, limits: { min: 1e-6, reason: 'K steht im Nenner und muss positiv sein.' } }),
    x0: real('Anfangswert', { latex: 'x_0', min: 0.1, max: 150, step: 0.1, default: 2 }),
    T: real('Zeitfenster', { latex: 'T', min: 2, max: 60, step: 1, default: 15, limits: { min: 0.01, reason: 'Das Zeitfenster muss positiv sein.' } }),
  },
  domain: (p) => [0, p.T],
  slope: (_t, x, p) => p.r * x * (1 - x / p.K),
  curves: {
    x: { label: 'x(t)', f: (t, p) => logistic(t, p.r, p.K, p.x0) },
    K: { label: 'K', role: 'reference', f: (_t, p) => p.K },
  },
  observables: ({ p }) => {
    // The inflection point sits at x = K/2, reached at t* = ln((K − x₀)/x₀) / r — if that is a time > 0.
    const t = Math.log((p.K - p.x0) / p.x0) / p.r
    const tw = Number.isFinite(t) && t > 0 ? t : null
    const mid = p.K / 2
    return {
      gleichgewicht: zahl('Gleichgewicht', p.K, { marks: [{ kind: 'value', v: p.K }] }),
      wendepunkt: zahl('steilste Stelle $t^*$', tw, {
        note: 'keine für t > 0',
        marks: tw === null ? [] : [{ kind: 'time', t: tw }, { kind: 'point', x: tw, y: mid, in: 'time' }],
      }),
      steigungMax: zahl('größte Steigung', tw === null ? null : (p.r * p.K) / 4, {
        note: 'nicht für t > 0',
        marks: tw === null ? [] : [{ kind: 'line', x: tw, y: mid, slope: (p.r * p.K) / 4, in: 'time' }],
      }),
    }
  },
})

export default defineApplet({
  id: 'log-ivp',
  titel: 'Logistisches Wachstum',
  kurz: 'Wachstum, das an eine Kapazitätsgrenze stößt.',
  model,
  formeln: [
    { label: 'Gleichung', tex: String.raw`\frac{dx}{dt} = {{r}}{{*}}x\left(1 - \frac{x}{{{K}}}\right)` },
    { label: 'Start', tex: String.raw`x(0) = {{x0}}` },
    { label: 'Lösung', tex: String.raw`x(t) = \frac{{{K}}{{*}}{{x0}}}{{{x0}} + ({{K}} - {{x0}})\,e^{-{{r}}\,t}}` },
  ],
  plots: [
    {
      type: 'timeSeriesContinuous',
      field: true,
      xLabel: 't',
      yLabel: 'x(t)',
      y: (p) => [0, Math.max(p.K, p.x0) * 1.1],
      drag: [
        { param: 'x0', axis: 'y' },
        { param: 'K', axis: 'y', at: (p) => [p.T, p.K] },
        // the steepest point (t*, K/2) with t* = ln((K − x₀)/x₀)/r: sliding it sideways sets r
        {
          param: 'r',
          axis: 'x',
          at: (p) => {
            const t = Math.log((p.K - p.x0) / p.x0) / p.r
            return Number.isFinite(t) && t > 0 ? [t, p.K / 2] : null
          },
          set: (x, _y, p) => ({ r: Math.log((p.K - p.x0) / p.x0) / Math.max(x, 0.05) }),
        },
      ],
    },
  ],
  zeitleiste: true,
  layout: { main: ['r', 'K', 'x0'] },
  anzeige: ['gleichgewicht', 'wendepunkt', 'steigungMax'],
})
