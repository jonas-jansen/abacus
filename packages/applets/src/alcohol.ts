// Alcohol in the body: the three-compartment model of Pieters et al. (1990), as in Heck,
// eJMT 1(3), Table 2.1. Concentrations in g/L in the stomach C_S, the gastrointestinal tract
// C_G and the blood (central compartment) C_C:
//   C_S' = −k₁ C_S / (1 + a C_S²)
//   C_G' =  k₁ C_S / (1 + a C_S²) − k₂ C_G
//   C_C' =  k₂ C_G − V_max C_C / (K_m + C_C)
// k₁ and a were fitted together per sex (one dose of 28.5 g after an overnight fast); the
// a C_S² term already slows gastric emptying for larger doses, so k₁ does not depend on the
// dose here. A dose D₀ (g per kg body weight) starts in the stomach as C_S(0) = D₀ / r with
// Widmark's distribution volume r (L/kg). Time in hours.

import { choice, ode, quantity, real, type Series } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

type Sex = 'male' | 'female'
type P = { sex: Sex; D0: number }

const SEX: Record<Sex, { Vmax: number; Km: number; a: number; k1: number; k2: number; r: number }> = {
  male: { Vmax: 0.47, Km: 0.38, a: 0.42, k1: 5.55, k2: 7.05, r: 0.7 },
  female: { Vmax: 0.48, Km: 0.405, a: 0.75, k1: 4.96, k2: 4.96, r: 0.6 },
}

/** The legal limit for drivers in Germany, 0.5 ‰ – about 0.5 g per litre of blood. */
const LIMIT = 0.5

const model = ode({
  id: 'alcohol',
  params: {
    sex: choice('Geschlecht', [{ value: 'male', label: 'Mann' }, { value: 'female', label: 'Frau' }], 'male'),
    D0: real('Dosis', { latex: 'D_0', min: 0.05, max: 1.2, step: 0.05, default: 0.3, unit: 'g/kg' }),
    T: real('Zeitfenster', { latex: 'T', min: 1, max: 24, step: 0.5, default: 8, unit: 'h', limits: { min: 0.01, reason: 'Das Zeitfenster muss positiv sein.' } }),
  },
  components: [
    // named in words: the applet shows no formulas, so symbols like C_G would explain nothing
    { id: 'CS', label: '', name: 'Alkoholkonzentration im Magen', role: 'tertiary' },
    { id: 'CG', label: '', name: 'Alkoholkonzentration im Darm', role: 'secondary' },
    { id: 'CC', label: '', name: 'Alkoholkonzentration im Blut', role: 'primary' },
  ],
  start: (p) => [p.D0 / SEX[p.sex].r, 0, 0],
  rhs: (_t, [CS, CG, CC], p) => {
    const s = SEX[p.sex]
    const emptying = (s.k1 * CS) / (1 + s.a * CS * CS)
    return [-emptying, emptying - s.k2 * CG, s.k2 * CG - (s.Vmax * CC) / (s.Km + CC)]
  },
  tEnd: (p) => p.T,
  samples: 600,
  extraSeries: ({ series }) => {
    const t = series.CC.x
    return [{ id: 'limit', label: '', name: 'Grenze im Straßenverkehr (0.5 ‰)', kind: 'continuous', x: t, y: t.map(() => LIMIT), role: 'reference' } satisfies Series]
  },
  observables: ({ series }) => {
    const { x: t, y: c } = series.CC
    let top = 0
    for (let i = 1; i < c.length; i++) if (c[i] > c[top]) top = i
    // linear interpolation of the time where C_C crosses a level, searching from index i on
    const crossing = (level: number, from: number, to: number, up: boolean) => {
      for (let i = Math.max(1, from); i <= to; i++) {
        const [a, b] = [c[i - 1] - level, c[i] - level]
        if (up ? a < 0 && b >= 0 : a > 0 && b <= 0) return t[i - 1] + ((t[i] - t[i - 1]) * a) / (a - b)
      }
      return null
    }
    const above = c[top] > LIMIT ? [crossing(LIMIT, 1, top, true), crossing(LIMIT, top + 1, c.length - 1, false)] : null
    const gone = crossing(0.01, top + 1, c.length - 1, false)
    return {
      spitze: quantity('höchster Blutalkohol (g/L)', c[top], { digits: 2, marks: [{ kind: 'point', x: t[top], y: c[top], in: 'time' }] }),
      wann: quantity('erreicht nach (h)', t[top], { digits: 2, marks: [{ kind: 'time', t: t[top] }] }),
      ueber: quantity('über 0.5 g/L (h)', above && above[0] !== null && above[1] !== null ? above[1] - above[0] : above ? null : 0, {
        digits: 2,
        note: above ? 'noch über der Grenze am Ende des Zeitfensters' : undefined,
        marks: above ? above.filter((x): x is number => x !== null).map((x) => ({ kind: 'time' as const, t: x })) : [],
      }),
      abgebaut: quantity('abgebaut nach (h)', gone, { digits: 2, note: 'noch nicht im Zeitfenster', marks: gone === null ? [] : [{ kind: 'time', t: gone }] }),
    }
  },
})

const PER_75KG = (D0: number) => `bei 75 kg also ${Math.round(D0 * 75)} g`

export default defineApplet({
  id: 'alcohol',
  model,
  horizon: 'T',
  scenariosOnly: true,
  plots: [
    { type: 'timeSeriesContinuous', series: ['CC', 'limit'], title: 'Alkohol im Blut', xLabel: '\\text{Stunden}', yLabel: '\\text{g/L}' },
    { type: 'timeSeriesContinuous', series: ['CS', 'CG', 'CC'], title: 'Wo der Alkohol ist', xLabel: '\\text{Stunden}', yLabel: '\\text{g/L}' },
  ],
  layout: { main: ['sex'] },
  readouts: ['spitze', 'wann', 'ueber', 'abgebaut'],
  scenarios: [
    { label: 'ein kleines Bier', text: `0.15 g Alkohol pro kg Körpergewicht: ${PER_75KG(0.15)}, etwa 0.3 l Bier`, params: { D0: 0.15 } },
    { label: 'ein großes Bier', text: `0.3 g Alkohol pro kg Körpergewicht: ${PER_75KG(0.3)}, etwa 0.5 l Bier oder 0.25 l Wein`, params: { D0: 0.3 } },
    { label: 'eine Flasche Wein zu zweit', text: `0.45 g Alkohol pro kg Körpergewicht: ${PER_75KG(0.45)}, etwa 0.4 l Wein oder 0.9 l Bier`, params: { D0: 0.45 } },
    { label: 'zwei große Bier', text: `0.6 g Alkohol pro kg Körpergewicht: ${PER_75KG(0.6)}, etwa 1.1 l Bier`, params: { D0: 0.6 } },
  ],
})
