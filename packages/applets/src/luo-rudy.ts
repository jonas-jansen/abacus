// The ventricular action potential of Luo & Rudy (1991), "A model of the ventricular cardiac
// action potential", Circ. Res. 68:1501–1526 (LR1): the membrane potential V (mV), six gates
// m, h, j (fast sodium), d, f (slow inward, calcium), X (time-dependent potassium) and the
// calcium inside the cell. Six currents:
//   C_m V' = −(I_Na + I_si + I_K + I_K1 + I_Kp + I_b) + I_stim
//   I_Na = 23 m³hj (V − E_Na)        I_si = 0.09 d f (V − E_si),  E_si = 7.7 − 13.0287 ln[Ca]ᵢ
//   I_K  = 0.282 √([K]ₒ/5.4) X Xᵢ (V − E_K)   I_K1 = 0.6047 √([K]ₒ/5.4) K1_∞ (V − E_K1)
//   I_Kp = 0.0183 Kp (V − E_Kp)      I_b = 0.03921 (V + 59.87)
//   [Ca]ᵢ' = −10⁻⁴ I_si + 0.07 (10⁻⁴ − [Ca]ᵢ)
// Time in ms, currents in µA/cm², C_m = 1 µF/cm². The scenarios scale the conductances of the
// sodium, calcium and potassium channels and change the potassium outside the cell, as drugs
// and diseases do; the stimulus is a short current pulse, once or in a rhythm.

import { category, ode, quantity, real } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

type P = { gNa: number; gsi: number; gK: number; Ko: number; I: number; Ts: number; S2: number }

const RTF = (8314 * 310) / 96485 // mV
const NA_O = 140
const NA_I = 18
const K_I = 145
const PR_NAK = 0.01833
const E_NA = RTF * Math.log(NA_O / NA_I)
const PULS = 2 // ms: length of a stimulus
const FIRST = 10 // ms: the first stimulus

/** Avoids 0/0 where a rate's formula has a removable singularity. */
const off = (v: number, at: number) => (Math.abs(v - at) < 1e-6 ? v + 1e-6 : v)

function rates(V: number, Ko: number) {
  const vm = off(V, -47.13)
  const am = (0.32 * (vm + 47.13)) / (1 - Math.exp(-0.1 * (vm + 47.13)))
  const bm = 0.08 * Math.exp(-V / 11)
  let ah: number, bh: number, aj: number, bj: number
  if (V >= -40) {
    ah = 0
    aj = 0
    bh = 1 / (0.13 * (1 + Math.exp((V + 10.66) / -11.1)))
    bj = (0.3 * Math.exp(-2.535e-7 * V)) / (1 + Math.exp(-0.1 * (V + 32)))
  } else {
    ah = 0.135 * Math.exp((80 + V) / -6.8)
    bh = 3.56 * Math.exp(0.079 * V) + 3.1e5 * Math.exp(0.35 * V)
    aj = ((-1.2714e5 * Math.exp(0.2444 * V) - 3.474e-5 * Math.exp(-0.04391 * V)) * (V + 37.78)) / (1 + Math.exp(0.311 * (V + 79.23)))
    bj = (0.1212 * Math.exp(-0.01052 * V)) / (1 + Math.exp(-0.1378 * (V + 40.14)))
  }
  const ad = (0.095 * Math.exp(-0.01 * (V - 5))) / (1 + Math.exp(-0.072 * (V - 5)))
  const bd = (0.07 * Math.exp(-0.017 * (V + 44))) / (1 + Math.exp(0.05 * (V + 44)))
  const af = (0.012 * Math.exp(-0.008 * (V + 28))) / (1 + Math.exp(0.15 * (V + 28)))
  const bf = (0.0065 * Math.exp(-0.02 * (V + 30))) / (1 + Math.exp(-0.2 * (V + 30)))
  const aX = (0.0005 * Math.exp(0.083 * (V + 50))) / (1 + Math.exp(0.057 * (V + 50)))
  const bX = (0.0013 * Math.exp(-0.06 * (V + 20))) / (1 + Math.exp(-0.04 * (V + 20)))
  const vx = off(V, -77)
  const Xi = V > -100 ? (2.837 * (Math.exp(0.04 * (vx + 77)) - 1)) / ((vx + 77) * Math.exp(0.04 * (vx + 35))) : 1
  const EK = RTF * Math.log((Ko + PR_NAK * NA_O) / (K_I + PR_NAK * NA_I))
  const EK1 = RTF * Math.log(Ko / K_I)
  const aK1 = 1.02 / (1 + Math.exp(0.2385 * (V - EK1 - 59.215)))
  const bK1 = (0.49124 * Math.exp(0.08032 * (V - EK1 + 5.476)) + Math.exp(0.06175 * (V - EK1 - 594.31))) / (1 + Math.exp(-0.5143 * (V - EK1 + 4.753)))
  const K1inf = aK1 / (aK1 + bK1)
  const Kp = 1 / (1 + Math.exp((7.488 - V) / 5.98))
  return { am, bm, ah, bh, aj, bj, ad, bd, af, bf, aX, bX, Xi, EK, EK1, K1inf, Kp }
}

/** The stimulus: pulses from FIRST on every Ts ms (Ts = 0: one pulse), and an extra one at S2. */
const stim = (t: number, p: P) => {
  const inPulse = (t0: number) => t >= t0 && t < t0 + PULS
  if (inPulse(FIRST)) return p.I
  if (p.Ts > 0 && t > FIRST && (t - FIRST) % p.Ts < PULS) return p.I
  if (p.S2 > 0 && inPulse(FIRST + p.S2)) return p.I
  return 0
}

/** The currents at a state; [Ca]ᵢ is kept in µM. */
function currents(y: ArrayLike<number>, p: P) {
  const [V, m, h, j, d, f, X, ca] = Array.from(y)
  const r = rates(V, p.Ko)
  const Cai = Math.max(ca, 1e-6) / 1000 // mM
  const kfac = Math.sqrt(p.Ko / 5.4)
  return {
    r,
    INa: p.gNa * m ** 3 * h * j * (V - E_NA),
    Isi: p.gsi * d * f * (V - (7.7 - 13.0287 * Math.log(Cai))),
    IK: p.gK * 0.282 * kfac * X * r.Xi * (V - r.EK),
    IK1: 0.6047 * kfac * r.K1inf * (V - r.EK1),
    IKp: 0.0183 * r.Kp * (V - r.EK1),
    Ib: 0.03921 * (V + 59.87),
    Cai,
  }
}

function rhs(t: number, y: Float64Array, p: P): number[] {
  const [, m, h, j, d, f, X] = y
  const c = currents(y, p)
  const r = c.r
  const gate = (a: number, b: number, x: number) => a * (1 - x) - b * x
  return [
    -(c.INa + c.Isi + c.IK + c.IK1 + c.IKp + c.Ib) + stim(t, p),
    gate(r.am, r.bm, m),
    gate(r.ah, r.bh, h),
    gate(r.aj, r.bj, j),
    gate(r.ad, r.bd, d),
    gate(r.af, r.bf, f),
    gate(r.aX, r.bX, X),
    1000 * (-1e-4 * c.Isi + 0.07 * (1e-4 - c.Cai)),
  ]
}

/** The resting state for [K]ₒ: the cell left alone for a while (no stimulus). */
const restCache = new Map<number, number[]>()
function rest(p: P): number[] {
  const hit = restCache.get(p.Ko)
  if (hit) return hit
  const q = { ...p, I: 0, Ts: 0, S2: 0 }
  const y = Float64Array.from([-84.5, 0.0017, 0.983, 0.995, 0.003, 1, 0.0057, 0.2])
  // Rush–Larsen: the gates exactly for frozen V (stable for any step), V and [Ca]ᵢ by Euler;
  // 3 s settle the slow gates
  const DT = 0.02
  const pairs = ['m', 'h', 'j', 'd', 'f', 'X'] as const
  for (let t = 0; t < 3000; t += DT) {
    const dy = rhs(0, y, q)
    const r = rates(y[0], q.Ko)
    const ab = { m: [r.am, r.bm], h: [r.ah, r.bh], j: [r.aj, r.bj], d: [r.ad, r.bd], f: [r.af, r.bf], X: [r.aX, r.bX] }
    pairs.forEach((g, k) => {
      const [a, b] = ab[g]
      const inf = a / (a + b)
      y[k + 1] = inf + (y[k + 1] - inf) * Math.exp(-(a + b) * DT)
    })
    y[0] += DT * dy[0]
    y[7] += DT * dy[7]
  }
  const out = Array.from(y)
  restCache.set(p.Ko, out)
  return out
}

/** The times the stimulus starts within [0, T]. */
function pulses(p: P, T: number): number[] {
  const out = [FIRST]
  if (p.Ts > 0) for (let t = FIRST + p.Ts; t < T; t += p.Ts) out.push(t)
  if (p.S2 > 0 && FIRST + p.S2 < T) out.push(FIRST + p.S2)
  return out.sort((a, b) => a - b)
}

/**
 * Which stimuli the cell answers, read from the solution: an answer is the sodium upstroke,
 * faster than 100 mV/ms – the stimulus alone moves V by I/C_m = 25 mV/ms. For each answer the
 * duration to 90 % repolarisation, and whether V turns upwards again on the way down with no
 * stimulus near (an early afterdepolarisation).
 */
function answers(sol: { at(t: number): Float64Array }, p: P, T: number) {
  const out: { t: number; peak: number; apd: number | null; ead: boolean }[] = []
  const starts = pulses(p, T)
  for (const s of starts) {
    let [vmax, slope, prev] = [-Infinity, 0, sol.at(s)[0]]
    const base = prev
    for (let t = s + 0.05; t <= Math.min(T, s + 12); t += 0.05) {
      const v = sol.at(t)[0]
      slope = Math.max(slope, (v - prev) / 0.05)
      vmax = Math.max(vmax, v)
      prev = v
    }
    if (slope < 100) continue
    // on the way back: 90 % of the way from the peak to where it started, before the next answer
    const level = vmax - 0.9 * (vmax - base)
    const stimNear = (t: number) => starts.some((q) => t >= q && t < q + 15)
    let [apd, ead, low] = [null as number | null, false, Infinity]
    for (let t = s + 20; t < T; t += 1) {
      // not the calcium dome after a slow upstroke (early, near 0 mV): an afterdepolarisation starts low in the plateau
      const late = t > s + 80
      const v = sol.at(t)[0]
      if (v <= level) {
        apd = t - s
        break
      }
      low = Math.min(low, v)
      if (late && !stimNear(t) && low < -15 && v > low + 5) ead = true
      if (stimNear(t)) low = Infinity
    }
    out.push({ t: s, peak: vmax, apd, ead })
  }
  return { starts, out }
}

const model = ode({
  id: 'luo-rudy',
  params: {
    gNa: real('Leitfähigkeit Natrium', { latex: 'g_{Na}', min: 0, max: 40, step: 0.5, default: 23, unit: 'mS/cm²' }),
    gsi: real('Leitfähigkeit Kalzium', { latex: 'g_{si}', min: 0, max: 0.2, step: 0.005, default: 0.09, unit: 'mS/cm²' }),
    gK: real('Kaliumkanäle (Anteil)', { latex: 'g_K', min: 0, max: 2, step: 0.05, default: 1 }),
    Ko: real('Kalium außen', { latex: '[K]_o', min: 2, max: 16, step: 0.1, default: 5.4, unit: 'mM' }),
    I: real('Reizstärke', { latex: 'I_{stim}', min: 0, max: 100, step: 1, default: 25, unit: 'µA/cm²' }),
    Ts: real('Reizabstand', { latex: 'T_{stim}', min: 0, max: 2000, step: 10, default: 0, unit: 'ms' }),
    S2: real('zweiter Reiz nach', { latex: 'S_2', min: 0, max: 1000, step: 10, default: 0, unit: 'ms' }),
    T: real('Zeitfenster', { latex: 'T', min: 100, max: 6000, step: 50, default: 500, unit: 'ms', limits: { min: 1, reason: 'Das Zeitfenster muss positiv sein.' } }),
  },
  components: [
    { id: 'V', label: 'V(t)', name: 'Membranpotential', role: 'primary' },
    { id: 'm', label: 'm', name: 'Na-Aktivierung', role: 'secondary' },
    { id: 'h', label: 'h', name: 'Na-Inaktivierung', role: 'tertiary' },
    { id: 'j', label: 'j', name: 'Na-Inaktivierung, langsam', role: 'tertiary' },
    { id: 'd', label: 'd', name: 'Ca-Aktivierung', role: 'secondary' },
    { id: 'f', label: 'f', name: 'Ca-Inaktivierung', role: 'tertiary' },
    { id: 'X', label: 'X', name: 'K-Aktivierung', role: 'reference' },
    { id: 'Ca', label: '[Ca]_i(t)', name: 'Kalzium in der Zelle', role: 'primary' },
  ],
  start: (p) => rest(p),
  rhs: (t, y, p) => rhs(t, y, p),
  tEnd: (p) => p.T,
  stiff: true,
  // the upstroke is sharp, but 10⁻³ keeps V within 0.01 mV of a much finer run, at a fifth of the steps
  tol: 1e-3,
  // no step longer than half a stimulus, so none is stepped over
  hmax: PULS / 2,
  samples: 2000,
  observables: ({ p, sol, series }) => {
    const T = sol.t1
    const { starts, out } = answers(sol, p, T)
    const restV = series.V.y[0]
    // the last complete action potential: under fast pacing it is shorter than the first
    const last = [...out].reverse().find((a) => a.apd !== null) ?? out[0]
    const eads = out.some((a) => a.ead)
    const answer = out.length === 0 ? 'keine Erregung' : eads ? 'Nacherregungen' : out.length < starts.length ? 'nicht jeder Reiz löst aus' : 'jeder Reiz löst aus'
    return {
      antwort: category('Die Zelle', answer, {
        note: answer === 'keine Erregung' ? 'der Reiz bleibt unter der Schwelle' : undefined,
        marks: out.map((a, item) => ({ kind: 'time' as const, t: a.t, item })),
      }),
      apd: quantity('Dauer des letzten Aktionspotentials (ms)', last?.apd ?? null, {
        digits: 3,
        note: last ? 'kehrt im Zeitfenster nicht zur Ruhe zurück' : 'kein Aktionspotential',
        marks: last?.apd ? [{ kind: 'time', t: last.t }, { kind: 'time', t: last.t + last.apd }] : [],
      }),
      spitze: quantity('höchstes Potential (mV)', out[0]?.peak ?? null, { digits: 3, note: 'kein Aktionspotential', marks: out[0] ? [{ kind: 'value', v: out[0].peak }] : [] }),
      ruhe: quantity('Ruhepotential (mV)', restV, { digits: 3, marks: [{ kind: 'value', v: restV }] }),
      schlaege: quantity('beantwortete Reize', out.length, { digits: 3, note: `von ${starts.length}`, marks: out.map((a, item) => ({ kind: 'time' as const, t: a.t, item })) }),
    }
  },
})

const BEAT = { Ts: 1000, T: 3000 }
/** a slow rhythm (30 per minute), so a long action potential ends before the next stimulus */
const SLOW = { Ts: 2000, T: 4000 }

export default defineApplet({
  id: 'luo-rudy',
  model,
  horizon: 'T',
  scenariosOnly: true,
  plots: [
    { type: 'timeSeriesContinuous', series: ['V'], title: 'Membranpotential', xLabel: 't \\text{ (ms)}', yLabel: 'V \\text{ (mV)}', y: [-100, 60] },
    { type: 'timeSeriesContinuous', series: ['Ca'], title: 'Kalzium in der Zelle', xLabel: 't \\text{ (ms)}', yLabel: '[Ca]_i \\text{ (µM)}' },
  ],
  readouts: ['antwort', 'apd', 'spitze', 'ruhe', 'schlaege'],
  scenarios: [
    { label: 'ein Herzschlag', text: 'Ein kurzer Stromstoß erregt die Herzmuskelzelle: Die Spannung springt nach oben, bleibt etwa 0.3 s auf einem Plateau und kehrt dann zur Ruhe zurück. Währenddessen strömt Kalzium ein – es lässt die Zelle sich zusammenziehen.', params: {} },
    { label: 'zu schwacher Reiz', text: 'Ein zu schwacher Stromstoß: Die Spannung hebt sich kurz und fällt zurück. Erst über einer Schwelle antwortet die Zelle – dann ganz („alles oder nichts“).', params: { I: 10 } },
    { label: 'ruhiger Puls', text: '60 Schläge pro Minute: Jeder Reiz löst ein gleiches Aktionspotential aus, mit Pause dazwischen.', params: BEAT },
    { label: 'schneller Puls', text: '150 Schläge pro Minute: Die Aktionspotentiale werden kürzer – sonst bliebe keine Zeit zum Entspannen.', params: { Ts: 400, T: 2400 } },
    { label: 'zweiter Reiz zu früh', text: 'Ein zweiter Reiz 0.2 s nach dem ersten bleibt ohne Antwort: Die Zelle ist noch nicht wieder erregbar (Refraktärzeit). So kann sich das Herz nicht verkrampfen.', params: { S2: 200, T: 800 } },
    { label: 'zweiter Reiz später', text: 'Kommt der zweite Reiz erst nach 0.4 s, antwortet die Zelle wieder – mit einem kürzeren Aktionspotential.', params: { S2: 400, T: 900 } },
    { label: 'zu viel Kalium im Blut', text: 'Bei zu viel Kalium im Blut (z. B. bei Nierenversagen) liegt die Ruhespannung höher; die Zelle springt schwächer an und erholt sich schneller.', params: { Ko: 10, ...BEAT } },
    { label: 'Natriumkanäle blockiert', text: 'Ein Medikament (wie das Betäubungsmittel Lidocain) blockiert viele Natriumkanäle: Der Aufstrich wird flacher und niedriger.', params: { gNa: 6, ...BEAT } },
    { label: 'Kalziumkanäle blockiert', text: 'Ein Kalziumkanal-Blocker (Mittel gegen Bluthochdruck) halbiert den Kalziumstrom: Das Plateau wird kürzer, es strömt weniger Kalzium ein – das Herz schlägt schwächer.', params: { gsi: 0.045, ...BEAT } },
    { label: 'Kaliumkanäle geschwächt', text: 'Geschwächte Kaliumkanäle (angeboren oder durch manche Medikamente, „langes QT“): Die Zelle kehrt viel später zur Ruhe zurück, das Aktionspotential dauert gut 0.5 s.', params: { gK: 0.5, ...SLOW } },
    { label: 'Nacherregungen', text: 'Sind die Kaliumkanäle noch schwächer, springt die Zelle während des Plateaus von selbst erneut an, bevor sie zur Ruhe kommt – solche Nacherregungen können gefährliche Rhythmusstörungen auslösen.', params: { gK: 0.4, ...SLOW } },
  ],
})
