// Cardiac action potential as a system of ODEs (slides IV 29–32), Hodgkin–Huxley type: the
// Purkinje-fibre model of Noble (1962). Membrane potential V (mV) and three gates m, h, n:
//   C_m V' = −(g_Na m³h + 0,14)(V − 40) − g_L (V − V_L)
//            − (1,2 e^{(−V−90)/50} + 0,015 e^{(V+90)/60} + g_K n⁴)(V + 100) + I_stim(t),
//   x' = (x_∞(V) − x)/τ_x(V)  for x = m, h, n.
// The slides don't list the gate functions x_∞, τ_x; they are Noble's. With g_L = 0,075,
// V_L = −60 mV the cell is a pacemaker: a periodic solution with period ≈ 0,56 s between
// −80 and +20 mV (IV 30). With g_L = 0,2, V_L = −85 mV it rests and fires only when
// stimulated, here every 0,7 s (IV 32). Time runs in seconds; the rates are per ms.

import { klasse, ode, periodOf, real, zahl } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

type P = { gNa: number; gK: number; gL: number; VL: number; I: number; Ts: number }
const CM = 12 // µF/cm²
const PULS = 0.002 // s: length of a stimulus

const gates = (V: number) => {
  const am = (0.1 * (-V - 48)) / (Math.exp((-V - 48) / 15) - 1)
  const bm = (0.12 * (V + 8)) / (Math.exp((V + 8) / 5) - 1)
  const ah = 0.17 * Math.exp((-V - 90) / 20)
  const bh = 1 / (Math.exp((-V - 42) / 10) + 1)
  const an = (0.0001 * (-V - 50)) / (Math.exp((-V - 50) / 10) - 1)
  const bn = 0.002 * Math.exp((-V - 90) / 80)
  return { am, bm, ah, bh, an, bn }
}

const stim = (t: number, p: P) => (p.I > 0 && p.Ts > 0 && t % p.Ts < PULS ? p.I : 0)

function rhs(t: number, [V, m, h, n]: ArrayLike<number> & Iterable<number>, p: P): number[] {
  const g = gates(V)
  const INa = (p.gNa * m ** 3 * h + 0.14) * (V - 40)
  const IK = (1.2 * Math.exp((-V - 90) / 50) + 0.015 * Math.exp((V + 90) / 60) + p.gK * n ** 4) * (V + 100)
  const IL = p.gL * (V - p.VL)
  // per ms → per s
  return [(1000 * (-(INa + IK + IL) + stim(t, p))) / CM, 1000 * (g.am * (1 - m) - g.bm * m), 1000 * (g.ah * (1 - h) - g.bh * h), 1000 * (g.an * (1 - n) - g.bn * n)]
}

const model = ode({
  id: 'herzzelle',
  params: {
    gL: real('Leitfähigkeit Leckstrom', { latex: 'g_L', min: 0, max: 0.5, step: 0.005, default: 0.075, unit: 'mS/cm²' }),
    VL: real('Umkehrpotential Leckstrom', { latex: 'V_L', min: -100, max: -40, step: 1, default: -60, unit: 'mV' }),
    gNa: real('Leitfähigkeit Natrium', { latex: 'g_{Na}', min: 100, max: 800, step: 10, default: 400, unit: 'mS/cm²' }),
    gK: real('Leitfähigkeit Kalium', { latex: 'g_K', min: 0, max: 3, step: 0.05, default: 1.2, unit: 'mS/cm²' }),
    I: real('Reizstärke', { latex: 'I_{stim}', min: 0, max: 300, step: 5, default: 0, unit: 'µA/cm²' }),
    Ts: real('Reizabstand', { latex: 'T_{stim}', min: 0.2, max: 2, step: 0.01, default: 0.7, unit: 's', limits: { min: 0.01, reason: 'Der Abstand der Reize muss positiv sein.' } }),
    T: real('Zeitfenster', { latex: 'T', min: 0.5, max: 10, step: 0.1, default: 2.5, unit: 's', limits: { min: 0.01, reason: 'Das Zeitfenster muss positiv sein.' } }),
  },
  components: [
    { id: 'V', label: 'V(t)', name: 'Membranpotential', role: 'primary' },
    { id: 'm', label: 'm', name: 'Na-Aktivierung', role: 'secondary' },
    { id: 'h', label: 'h', name: 'Na-Inaktivierung', role: 'tertiary' },
    { id: 'n', label: 'n', name: 'K-Aktivierung', role: 'reference' },
  ],
  start: () => [-87, 0.01, 0.8, 0.01],
  rhs: (t, y, p) => rhs(t, y, p),
  tEnd: (p) => p.T,
  stiff: true,
  tol: 1e-5,
  // no step longer than half a stimulus, so none is stepped over
  hmax: PULS / 2,
  samples: 1500,
  observables: ({ p, series }) => {
    const V = series.V
    const per = periodOf(V.x, V.y, { from: 0.25, tol: 0.05 })
    let [lo, hi] = [Infinity, -Infinity]
    for (let i = Math.floor(V.y.length / 4); i < V.y.length; i++) (lo = Math.min(lo, V.y[i])), (hi = Math.max(hi, V.y[i]))
    const feuert = hi > 0
    const art = !feuert ? 'ruht' : p.I > 0 && per && Math.abs(per.period - p.Ts) < 0.02 * p.Ts ? 'folgt den Reizen' : 'feuert von selbst'
    return {
      art: klasse('Die Zelle', art, art === 'feuert von selbst' ? { note: 'eine periodische Lösung ohne äußeren Reiz: Schrittmacher' } : {}),
      periode: zahl('Periode', per?.period ?? null, { digits: 3, note: per ? undefined : 'keine gleichmäßige Wiederholung', marks: per ? per.crossings.map((t, item) => ({ kind: 'time' as const, t, item })) : [] }),
      spitze: zahl('höchstes Potential (mV)', hi, { digits: 3 }),
      ruhe: zahl('tiefstes Potential (mV)', lo, { digits: 3 }),
    }
  },
})

export default defineApplet({
  id: 'herzzelle',
  titel: 'Aktionspotential: Schrittmacher und Muskelzelle',
  kurz: 'Ein System aus vier Differentialgleichungen – periodisch von selbst oder im Takt eines Reizes.',
  kapitel: 'IV',
  folien: '29–32',
  model,
  horizont: 'T',
  formeln: [
    {
      label: 'Membran',
      tex: String.raw`C_m V' = -({{gNa}}\,m^3 h + 0{,}14)(V - 40) - {{gL}}\,(V - {{VL}}) \\ \qquad - \bigl(1{,}2\,e^{\frac{-V-90}{50}} + 0{,}015\,e^{\frac{V+90}{60}} + {{gK}}\,n^4\bigr)(V + 100) + I_{stim}(t)`,
    },
    { label: 'Tore', tex: String.raw`m' = \frac{m_\infty(V) - m}{\tau_m(V)}, \; \text{ebenso } h, n \\ I_{stim} = {{I}} \text{ alle } {{Ts}}\,\text{s für 2 ms}` },
  ],
  plots: [
    { type: 'timeSeriesContinuous', series: ['V'], title: 'Membranpotential', xLabel: 't', yLabel: 'V \\text{ (mV)}', y: [-100, 50] },
    { type: 'timeSeriesContinuous', series: ['m', 'h', 'n'], title: 'Tore', xLabel: 't', yLabel: 'm, h, n', y: [0, 1] },
  ],
  layout: { main: ['gL', 'VL', 'I'] },
  anzeige: ['art', 'periode', 'spitze', 'ruhe'],
  szenarien: [
    { label: 'Schrittmacherzelle', text: 'g_L = 0,075, V_L = −60 mV, kein Reiz: feuert von selbst (Folie 30)', params: {} },
    { label: 'Muskelzelle', text: 'g_L = 0,2, V_L = −85 mV, Reiz alle 0,7 s: feuert im Takt (Folie 32)', params: { gL: 0.2, VL: -85, I: 150, Ts: 0.7, T: 2.2 } },
    { label: 'Muskelzelle ohne Reiz', text: 'dieselbe Zelle ohne Reiz: sie ruht', params: { gL: 0.2, VL: -85, I: 0, T: 2.2 } },
  ],
})
