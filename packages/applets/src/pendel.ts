// Damped pendulum (slides IV 5–7): α'' = −(b/m) α' − (g/l) sin α, as a system of first order
// with x₁ = α, x₂ = α'. Resting at the bottom (0, 0) is stable (a spiral with damping, a
// centre without); upright (±π, 0) is a saddle. Swinging far, the period is longer than the
// 2π√(l/g) of small oscillations; with enough speed the pendulum goes over the top.

import { equilibria2, formatNumber, category, list, ode, periodOf, point, real, quantity, type Mark } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

const G = 9.81
type P = { d: number; l: number }
const f = ([a, w]: ArrayLike<number> & Iterable<number>, p: P) => [w, -p.d * w - (G / p.l) * Math.sin(a)]

/** A multiple of π as text: "−2π", "−π", "0", "π", "2π" (others as numbers). */
function vielfachesPi(v: number): string {
  const k = Math.round(v / Math.PI)
  if (Math.abs(v - k * Math.PI) > 1e-6) return formatNumber(v, 4)
  return k === 0 ? '0' : `${k < 0 ? '−' : ''}${Math.abs(k) === 1 ? '' : Math.abs(k)}π`
}

const model = ode({
  id: 'pendel',
  params: {
    d: real('Dämpfung', { latex: 'b/m', min: 0, max: 2, step: 0.01, default: 0.3, unit: '1/s', limits: { min: 0, reason: 'Reibung bremst: die Dämpfung ist nicht negativ.' } }),
    l: real('Pendellänge', { latex: 'l', min: 0.1, max: 5, step: 0.01, default: 1, unit: 'm', limits: { min: 1e-3, reason: 'l steht im Nenner.' } }),
    start: point('Anfang', { latex: '(\\alpha_0, \\alpha_0\')', xBounds: [-7, 7], yBounds: [-10, 10], default: [2.5, 0] }),
    T: real('Zeitfenster', { latex: 'T', min: 2, max: 60, step: 1, default: 20, unit: 's', limits: { min: 0.1, reason: 'Das Zeitfenster muss positiv sein.' } }),
  },
  components: [
    { id: 'a', label: '\\alpha(t)', name: 'Auslenkung', role: 'primary' },
    { id: 'w', label: "\\alpha'(t)", name: 'Winkelgeschwindigkeit', role: 'secondary' },
  ],
  start: (p) => p.start,
  rhs: (_t, y, p) => f(y, p),
  tEnd: (p) => p.T,
  samples: 1200,
  observables: ({ p, series }) => {
    const eq = equilibria2((y) => f(y, p), [[-7, 7], [-10, 10]])
    const mark = (x: readonly [number, number]): Mark => ({ kind: 'point', x: x[0], y: x[1], in: 'phase' })
    const unten = eq.find((e) => Math.abs(e.x[0]) < 1e-6)
    const oben = eq.filter((e) => Math.abs(Math.abs(e.x[0]) - Math.PI) < 1e-6)
    const a = series.a
    const per = periodOf(a.x, a.y, { from: 0, tol: 0.08 })
    const T0 = 2 * Math.PI * Math.sqrt(p.l / G)
    const ueber = a.y.some((v) => Math.abs(v) > Math.PI)
    return {
      unten: category('Ruhelage unten $(0, 0)$', unten?.typ ?? null, { marks: unten ? [mark(unten.x)] : [] }),
      oben: category('Ruhelage oben $(\\pm\\pi, 0)$', oben[0]?.typ ?? null, { marks: oben.map((e) => mark(e.x)) }),
      periode: quantity('Schwingungsdauer (gemessen)', ueber ? null : (per?.period ?? null), {
        digits: 3,
        note: ueber ? 'das Pendel überschlägt sich' : per ? undefined : 'keine gleichmäßige Schwingung im Zeitfenster',
        marks: per ? per.crossings.map((t) => ({ kind: 'time' as const, t })) : [],
      }),
      klein: quantity('kleine Auslenkung: $2\\pi\\sqrt{l/g}$', T0, { digits: 3 }),
      // multiples of π: −2π, −π, 0, π, 2π
      gleichgewichte: list('Gleichgewichte $\\alpha^*$', eq.map((e) => vielfachesPi(e.x[0])), { marks: eq.map((e, item) => ({ ...mark(e.x), item })) }),
    }
  },
})

export default defineApplet({
  id: 'pendel',
  model,
  horizon: 'T',
  formulas: [
    { label: 'Gleichung', tex: String.raw`\alpha'' = -{{d}}\,\alpha' - \frac{g}{{{l}}}\,\sin\alpha` },
    { label: 'System', tex: String.raw`x_1' = x_2 \\ x_2' = -{{d}}\,x_2 - \frac{g}{{{l}}}\,\sin x_1` },
    { label: 'Start', tex: String.raw`(x_1, x_2)(0) = {{#start}}` },
  ],
  plots: [
    { type: 'timeSeriesContinuous', xLabel: 't', yLabel: '\\alpha, \\alpha\'' },
    {
      type: 'phasePlane',
      xSeries: 'a',
      ySeries: 'w',
      xLabel: '\\alpha',
      yLabel: "\\alpha'",
      x: [-7, 7],
      y: [-10, 10],
      field: true,
      nullclines: true,
      bahnen: true,
      drag: { param: 'start', axis: 'xy' },
    },
  ],
  readouts: ['unten', 'oben', 'periode', 'klein', 'gleichgewichte'],
  scenarios: [
    { label: 'kleine Auslenkung', text: 'α₀ = 0,2: fast wie eine Sinusschwingung', params: { start: [0.2, 0] } },
    { label: 'ohne Dämpfung', text: 'b/m = 0: die Bahn schließt sich, das Pendel schwingt ewig', params: { d: 0, start: [2.5, 0] } },
    { label: 'Überschlag', text: 'kräftig angestoßen: über den höchsten Punkt, dann Schwingen um die nächste Ruhelage', params: { start: [0, 8] } },
  ],
})
