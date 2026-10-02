// Discrete vs. continuous logistic growth (slides III 42–47, 71–72). The continuous model
// N' = r (1 − N/K) N always approaches K monotonically; the discrete one
// N_{n+1} = N_n + r_d (1 − N_n/K) N_n can overshoot, oscillate and settle into a 2-cycle.
// With a step h, N_{n+1} = N_n + h r_d (1 − N_n/K) N_n is Euler's method (III 72): as h
// shrinks (with r_d = r) the points close in on the curve; h = 1 is the discrete model.

import { closedForm, detectPeriod, index, real, verhalten, zahl } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

type P = { r: number; rd: number; K: number; N0: number; h: number; T: number }

const exact = (t: number, p: P) => (p.N0 * p.K) / (p.N0 + (p.K - p.N0) * Math.exp(-p.r * t))

/** The points N_n at t_n = n h. */
function diskret(p: P): { t: Float64Array; N: Float64Array } {
  const steps = Math.max(1, Math.min(20_000, Math.floor(p.T / p.h + 1e-9)))
  const t = new Float64Array(steps + 1)
  const N = new Float64Array(steps + 1)
  N[0] = p.N0
  for (let n = 0; n < steps; n++) {
    N[n + 1] = N[n] + p.h * p.rd * (1 - N[n] / p.K) * N[n]
    t[n + 1] = (n + 1) * p.h
  }
  return { t, N }
}

/** Start of the discrete 2-cycle at step 1 (slides III 46–47), for r_d > 2. */
function zyklus(rd: number, K: number, s: -1 | 1) {
  // the cycle of z = r_d N / ((1 + r_d) K) under z ↦ (1 + r_d) z (1 − z)
  const z = (rd + 2 + s * Math.sqrt(rd * rd - 4)) / (2 * rd + 2)
  return (z * (1 + rd) * K) / rd
}

const model = closedForm({
  id: 'logistic-vergleich',
  params: {
    r: real('Wachstumsrate (kontinuierlich)', { latex: 'r', min: 0, max: 3.5, step: 0.01, default: 2.1 }),
    rd: real('Wachstumsrate (diskret)', { latex: 'r_d', min: 0, max: 3.5, step: 0.01, default: 2.1 }),
    K: real('Kapazität', { latex: 'K', min: 1, max: 400, step: 1, default: 210, limits: { min: 1e-6, reason: 'K steht im Nenner.' } }),
    N0: real('Anfangswert', { latex: 'N_0', min: 0, max: 300, step: 0.1, default: 0.2 }),
    h: real('Schrittweite', { latex: 'h', min: 0.05, max: 1, step: 0.01, default: 1, limits: { min: 0.001, reason: 'Die Schrittweite muss positiv sein.' } }),
    T: real('Zeitfenster', { latex: 'T', min: 5, max: 60, step: 1, default: 30, limits: { min: 0.1, reason: 'Das Zeitfenster muss positiv sein.' } }),
  },
  domain: (p) => [0, p.T],
  samples: 600,
  curves: {
    N: { label: 'N(t)', name: 'kontinuierlich', role: 'primary', f: (t, p) => exact(t, p) },
  },
  extraSeries: ({ p }) => {
    const d = diskret(p)
    return [
      { id: 'Nn', label: 'N_n', name: p.h === 1 ? 'diskret' : 'diskret (Euler)', kind: 'discrete', x: d.t, y: d.N, role: 'secondary' },
      { id: 'K', label: 'K', name: 'Kapazität', kind: 'continuous', x: Float64Array.of(0, p.T), y: Float64Array.of(p.K, p.K), role: 'reference' },
    ]
  },
  observables: ({ p }) => {
    const d = diskret(p)
    // the long-term behaviour from a long run, whatever window is shown
    const long = diskret({ ...p, T: 4000 * p.h }).N
    const periode = detectPeriod(long.subarray(long.length - 64), { maxPeriod: 16 })
    const abstand = d.t.reduce((m, t, i) => Math.max(m, Math.abs(d.N[i] - exact(t, p))), 0)
    return {
      kontinuierlich: zahl('kontinuierlich: Grenzwert', p.N0 > 0 ? p.K : 0, { marks: [{ kind: 'value', v: p.K }] }),
      diskret: verhalten('diskret: Verhalten', long),
      periode: index('diskret: Periode', periode, periode === null ? { note: 'keine Periode ≤ 16 – Chaos?' } : {}),
      abstand: zahl('größter Abstand $|N_n - N(t_n)|$', abstand, { digits: 3 }),
    }
  },
})

export default defineApplet({
  id: 'logistic-vergleich',
  model,
  zeitleiste: true,
  horizont: 'T',
  formeln: [
    { label: 'Kontinuierlich', tex: String.raw`N' = {{r}}\left(1 - \frac{N}{{{K}}}\right) N` },
    { label: 'Diskret', tex: String.raw`N_{n+1} = N_n + {{h}}{{*}}{{rd}}\left(1 - \frac{N_n}{{{K}}}\right) N_n` },
    { label: 'Start', tex: String.raw`N(0) = N_0 = {{#N0}}` },
  ],
  plots: [
    {
      type: 'timeSeriesContinuous',
      series: ['N', 'Nn', 'K'],
      xLabel: 't',
      yLabel: 'N',
      drag: { param: 'N0', axis: 'y' },
    },
  ],
  layout: { main: ['r', 'rd', 'h'] },
  anzeige: ['kontinuierlich', 'diskret', 'periode', 'abstand'],
  szenarien: [
    { label: 'Folie 43', text: 'r = 0,55, r_d = 1,2 r: qualitativ ähnlich', params: { r: 0.55, rd: 0.66, N0: 0.2, K: 210, h: 1, T: 30 } },
    { label: 'Folie 44', text: 'r = r_d = 3: die diskrete Folge springt chaotisch', params: { r: 3, rd: 3, N0: 0.2, K: 210, h: 1, T: 30 } },
    { label: 'Folie 45', text: 'r = r_d = 2,1: die diskrete Folge pendelt sich zwischen zwei Werten ein', params: { r: 2.1, rd: 2.1, N0: 0.2, K: 210, h: 1, T: 30 } },
    { label: 'Folie 46', text: 'Start genau auf dem 2-Zyklus: periodisch von Anfang an', params: { r: 2.1, rd: 2.1, N0: Math.round(zyklus(2.1, 210, -1) * 1e4) / 1e4, K: 210, h: 1, T: 30 } },
    { label: 'Euler, h = 0,1', text: 'kleine Schritte: die Punkte liegen auf der Kurve (Folie 72)', params: { r: 2.1, rd: 2.1, N0: 0.2, K: 210, h: 0.1, T: 30 } },
  ],
})
