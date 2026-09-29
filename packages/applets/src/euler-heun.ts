// MATLAB: app_numdiffsol — Newton cooling in a room that cools down itself:
//   T' = −0,6 (T − (293,5 − 1,35 t)),  T(0) = 315,  exact T(t) = 19,25 e^{−0,6t} − 1,35 t + 295,75.
// Euler (order 1) and Heun (order 2) with m steps on [0, 10]. Halving h should halve Euler's
// error and quarter Heun's; Euler is stable only for h < 2/0,6 (m ≥ 4) and free of
// oscillation for h < 1/0,6 (m ≥ 7).

import { bool, defineModel, int, liste, zahl, type Observable, type Series } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

const T_END = 10
/** Height of the step-width bracket, below all curves. */
const BAR = 278.8
const T0 = 315
const f = (t: number, T: number) => -0.6 * (T - (293.5 - 1.35 * t))
const exact = (t: number) => 19.25 * Math.exp(-0.6 * t) - 1.35 * t + 295.75

type Method = 'euler' | 'heun'

function solve(method: Method, m: number): { t: Float64Array; T: Float64Array } {
  const h = T_END / m
  const t = Float64Array.from({ length: m + 1 }, (_, i) => i * h)
  const T = new Float64Array(m + 1)
  T[0] = T0
  for (let i = 0; i < m; i++) {
    const k1 = f(t[i], T[i])
    if (method === 'euler') T[i + 1] = T[i] + h * k1
    else {
      const k2 = f(t[i + 1], T[i] + h * k1)
      T[i + 1] = T[i] + (h / 2) * (k1 + k2)
    }
  }
  return { t, T }
}

/** The largest error at the grid points: robust against a lucky cancellation at t = 10. */
const maxError = (method: Method, m: number) => {
  const { t, T } = solve(method, m)
  let e = 0
  for (let i = 0; i <= m; i++) e = Math.max(e, Math.abs(T[i] - exact(t[i])))
  return e
}

type P = { m: number; euler: boolean; heun: boolean; exakt: boolean }

const model = defineModel({
  id: 'euler-heun',
  kind: 'closedForm',
  params: {
    m: int('Schritte', { latex: 'm', min: 1, max: 51, default: 5, limits: { min: 1, max: 100_000, reason: 'Mindestens ein Schritt; mehr als 100 000 zeigen nichts Neues.' } }),
    euler: bool('Euler', { labelOn: 'an', labelOff: 'aus', default: true }),
    heun: bool('Heun', { labelOn: 'an', labelOff: 'aus', default: true }),
    exakt: bool('exakte Lösung', { labelOn: 'an', labelOff: 'aus', default: true }),
  },
  run(p: P, opts) {
    const series: Series[] = []
    if (p.exakt) {
      const t = Float64Array.from({ length: 401 }, (_, i) => (i * T_END) / 400)
      series.push({ id: 'exakt', label: 'T(t)', kind: 'continuous', x: t, y: t.map(exact), role: 'reference' })
    }
    // the step width as a bracket along the bottom: |——| from t = 0 to t = h
    const h = T_END / p.m
    series.push({
      id: 'schritt',
      label: 'h',
      kind: 'continuous',
      x: Float64Array.of(0, 0, NaN, 0, h, NaN, h, h),
      y: Float64Array.of(BAR - 0.9, BAR + 0.9, NaN, BAR, BAR, NaN, BAR - 0.9, BAR + 0.9),
      role: 'annotation',
    })
    const methods: [Method, boolean, string, Series['role']][] = [
      ['euler', p.euler, '\\text{Euler}', 'secondary'],
      ['heun', p.heun, '\\text{Heun}', 'primary'],
    ]
    for (const [id, on, label, role] of methods) {
      if (!on) continue
      const { t, T } = solve(id, p.m)
      series.push({ id, label, kind: 'discrete', x: t, y: T, role })
    }
    const observables: Record<string, Observable> = {}
    if (opts.observables !== false) {
      const worst = (method: Method) => {
        const { t, T } = solve(method, p.m)
        let i = 0
        for (let k = 1; k <= p.m; k++) if (Math.abs(T[k] - exact(t[k])) > Math.abs(T[i] - exact(t[i]))) i = k
        return [
          { kind: 'point', x: t[i], y: T[i], in: 'time' },
          { kind: 'point', x: t[i], y: exact(t[i]), in: 'time' },
          { kind: 'time', t: t[i] },
        ] as const
      }
      // halving h divides the error by 2^order: about 2 for Euler, 4 for Heun once h is small
      const ratio = (method: Method) => maxError(method, p.m) / maxError(method, 2 * p.m)
      observables.h = zahl('Schrittweite $h = 10/m$', T_END / p.m, { digits: 3, marks: [{ kind: 'time', t: T_END / p.m }] })
      observables.fehlerEuler = zahl('größter Fehler Euler', maxError('euler', p.m), { digits: 3, marks: worst('euler') })
      observables.fehlerHeun = zahl('größter Fehler Heun', maxError('heun', p.m), { digits: 3, marks: worst('heun') })
      observables.ordnung = liste('halbes $h$ teilt den Fehler durch (Euler, Heun)', [ratio('euler'), ratio('heun')], { digits: 3 })
    }
    return { series, observables, meta: {} }
  },
})

export default defineApplet({
  id: 'euler-heun',
  titel: 'Euler- und Heun-Verfahren',
  kurz: 'Zwei Näherungsverfahren gegen die exakte Lösung: Wie schnell wird der Fehler kleiner?',
  model,
  formeln: [
    { label: 'Gleichung', tex: String.raw`T' = -0{,}6\,\bigl(T - (293{,}5 - 1{,}35\,t)\bigr)` },
    { label: 'Exakt', tex: String.raw`T(t) = 19{,}25\,e^{-0{,}6\,t} - 1{,}35\,t + 295{,}75 \quad {{exakt}}` },
    { label: 'Schrittweite', tex: String.raw`h = \frac{10}{{{m}}}` },
    { label: 'Euler', tex: String.raw`T_{n+1} = T_n + h\,f(t_n, T_n) \quad {{euler}}` },
    { label: 'Heun', tex: String.raw`T_{n+1} = T_n + \tfrac{h}{2}\,\bigl(f(t_n, T_n) + f(t_{n+1}, T_n + h\,f(t_n, T_n))\bigr) \quad {{heun}}` },
  ],
  plots: [
    {
      type: 'timeSeriesContinuous',
      xLabel: 't',
      yLabel: 'T',
      x: [-0.25, 10.25],
      y: [277, 318],
      // the first grid point sits at t = h: pull it to change the step width
      // the bracket's right end: pull it to change the step width, away from the data
      drag: [{ param: 'm', label: 'h', axis: 'x', at: (p) => [T_END / p.m, BAR], set: (x) => ({ m: Math.max(1, Math.round(T_END / Math.max(x, 0.01))) }) }],
    },
  ],
  layout: { main: ['m', 'euler', 'heun', 'exakt'] },
  anzeige: ['h', 'fehlerEuler', 'fehlerHeun', 'ordnung'],
})
