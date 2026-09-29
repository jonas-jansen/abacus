// MATLAB: app_log_IVPdata — fit the logistic curve N(t) = N₀ K e^{rt} / (K + N₀ (e^{rt} − 1))
// to 37 measurements by hand. The mean deviation says how well; the residuals show where.

import { bool, closedForm, real, rmsFehler, zahl, type Series } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

/** Measurements from the MATLAB app (t = 0, 1, …, 36). */
const DATA = Float64Array.from([
  0.17, 0.34, 0.48, 1.1, 1.4, 3.1, 3.5, 9.0, 10.0, 25.4, 27.0, 55.0, 76.0, 115, 160, 162, 190, 193, 190, 209, 190, 210,
  200, 215, 220, 200, 180, 213, 210, 210, 220, 213, 200, 211, 200, 208, 230,
])
const TD = Float64Array.from(DATA, (_, i) => i)

const N = (t: number, r: number, K: number, N0: number) => (N0 * K * Math.exp(r * t)) / (K + N0 * (Math.exp(r * t) - 1))

const model = closedForm({
  id: 'log-ivp-data',
  params: {
    r: real('Wachstumsrate', { latex: 'r', min: 0, max: 3, step: 0.01, default: 1.2 }),
    K: real('Kapazität', { latex: 'K', min: 1, max: 350, step: 1, default: 150, limits: { min: 1e-6, reason: 'K muss positiv sein.' } }),
    N0: real('Anfangswert', { latex: 'N_0', min: 0.01, max: 50, step: 0.01, default: 10, scale: 'log' }),
    abweichungen: bool('Abweichungen', { labelOn: 'zeigen', labelOff: 'verbergen', default: true }),
  },
  domain: [0, 36],
  curves: { N: { label: 'N(t)', name: 'Modell', role: 'primary', f: (t, p) => N(t, p.r, p.K, p.N0) } },
  extraSeries: ({ p }) => {
    const out: Series[] = [{ id: 'daten', label: 'N_i', name: 'Messwerte', kind: 'discrete', x: TD, y: DATA, role: 'data', connect: false }]
    if (p.abweichungen) {
      // vertical segments data → curve, separated by NaN
      const x = new Float64Array(TD.length * 3)
      const y = new Float64Array(TD.length * 3)
      TD.forEach((t, i) => {
        x.set([t, t, NaN], 3 * i)
        y.set([DATA[i], N(t, p.r, p.K, p.N0), NaN], 3 * i)
      })
      out.unshift({ id: 'res', label: 'd_i', name: 'Abweichungen', kind: 'continuous', x, y, role: 'ghost' })
    }
    return out
  },
  observables: ({ p }) => {
    const fit = (t: number) => N(t, p.r, p.K, p.N0)
    let worst = 0
    TD.forEach((t, i) => {
      if (Math.abs(fit(t) - DATA[i]) > Math.abs(fit(TD[worst]) - DATA[worst])) worst = i
    })
    return {
      rms: zahl('mittlere Abweichung (RMS)', rmsFehler(fit, TD, DATA), { digits: 3 }),
      groesste: zahl('größte Abweichung', Math.abs(fit(TD[worst]) - DATA[worst]), {
        digits: 3,
        marks: [
          { kind: 'point', x: TD[worst], y: DATA[worst], in: 'time' },
          { kind: 'time', t: TD[worst] },
        ],
      }),
      kapazitaet: zahl('Sättigung $K$', p.K, { marks: [{ kind: 'value', v: p.K }] }),
    }
  },
})

export default defineApplet({
  id: 'log-ivp-data',
  titel: 'Logistisches Modell an Daten anpassen',
  kurz: 'Drei Regler, 37 Messwerte: Wie gut lässt sich das Wachstum beschreiben?',
  kapitel: 'III',
  folien: '35–36',
  model,
  formeln: [
    { label: 'Gleichung', tex: String.raw`\frac{dN}{dt} = {{r}}{{*}}N\left(1 - \frac{N}{{{K}}}\right)` },
    { label: 'Start', tex: String.raw`N(0) = {{#N0}}` },
    { label: 'Lösung', tex: String.raw`N(t) = \frac{{{N0}}{{*}}{{K}}{{*}}e^{{{r}}\,t}}{{{K}} + {{N0}}\,(e^{{{r}}\,t} - 1)} \\ d_i = N(t_i) - N_i \quad {{abweichungen}}` },
  ],
  plots: [
    {
      type: 'timeSeriesContinuous',
      series: ['res', 'N', 'daten'],
      xLabel: 't',
      yLabel: 'N',
      y: [0, 240],
      // fit by hand: start, ceiling, and where the curve is steepest
      drag: [
        { param: 'N0', axis: 'y' },
        { param: 'K', axis: 'y', at: (p) => [36, p.K] },
        {
          param: 'r',
          axis: 'x',
          at: (p) => {
            const t = Math.log((p.K - p.N0) / p.N0) / p.r
            return Number.isFinite(t) && t > 0 ? [t, p.K / 2] : null
          },
          set: (x, _y, p) => ({ r: Math.log((p.K - p.N0) / p.N0) / Math.max(x, 0.05) }),
        },
      ],
    },
  ],
  anzeige: ['rms', 'groesste', 'kapazitaet'],
})
