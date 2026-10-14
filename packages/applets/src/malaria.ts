// Malaria tropica (Plasmodium falciparum) in the blood: after about a week in the liver the
// parasites enter red blood cells. In each cell one parasite multiplies; after 48 hours the
// cell bursts and 16–32 new parasites leave it, of which many find no new cell. In people
// without immunity the number grows about 8-fold per 48-hour cycle (estimates range from 6 to
// 20), a geometric progression x_{n+1} = 8 x_n with n counting cycles, drawn in days.
//
// Reference levels for the whole body (about 5 L of blood, 2.5·10¹³ red blood cells):
//   10⁵    parasites leaving the liver (a few infected liver cells, 10 000–40 000 each)
//   10⁸    seen under the microscope (about 20 per µL)
//   10⁹    fever in people without immunity
//   10¹¹   life-threatening: a few percent of the red blood cells infected
// An artemisinin drug cuts the number about 10 000-fold per cycle (the "parasite reduction
// ratio"); fewer than one parasite counts as cleared.

import { choice, iteration, quantity, real, steps, type Series } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

type Treat = 'none' | 'fever' | 'late'
type P = { x0: number; a: number; treat: Treat; N: number }

const DAYS_PER_CYCLE = 2
const LEVELS = { nachweisbar: 1e8, fieber: 1e9, lebensbedrohlich: 1e11 }
/** The drug's factor per cycle. */
const DRUG = 1e-4

/** From which cycle on the drug works: the first count at or above the scenario's level. */
const startsTreatment = (x: number, p: P) => (p.treat === 'fever' && x >= LEVELS.fieber) || (p.treat === 'late' && x >= LEVELS.lebensbedrohlich)

const model = iteration({
  id: 'malaria',
  params: {
    x0: real('Parasiten aus der Leber', { latex: 'x_0', min: 1e3, max: 1e7, step: 1e3, default: 1e5 }),
    a: real('Faktor pro Zyklus', { latex: 'a', min: 1, max: 20, step: 0.5, default: 8 }),
    treat: choice('Behandlung', [{ value: 'none', label: 'keine' }, { value: 'fever', label: 'bei Fieber' }, { value: 'late', label: 'spät' }], 'none'),
    N: steps('Zyklen', { latex: 'N', default: 8, max: 20 }),
  },
  start: (p) => p.x0,
  // once treated, the drug keeps working until the parasites are gone
  step: (x, p, n) => {
    let treated = false
    let y = p.x0
    for (let k = 0; k <= n && !treated; k++) {
      treated = startsTreatment(y, p)
      y *= p.a
    }
    const next = treated ? x * DRUG : x * p.a
    return next < 1 ? 0 : next
  },
  horizon: (p) => p.N,
  stepLength: DAYS_PER_CYCLE,
  series: { label: '', name: 'Parasiten im Blut' },
  extraSeries: ({ p }) => {
    const end = p.N * DAYS_PER_CYCLE
    // dashed, so no level is taken for a curve of data
    const line = (id: string, name: string, v: number, role: Series['role']): Series => ({ id, label: '', name, kind: 'continuous', x: Float64Array.of(0, end), y: Float64Array.of(v, v), role, dash: [5, 4] })
    return [
      line('nachweisbar', 'unter dem Mikroskop sichtbar', LEVELS.nachweisbar, 'reference'),
      line('fieber', 'Fieber', LEVELS.fieber, 'tertiary'),
      line('lebensbedrohlich', 'lebensbedrohlich', LEVELS.lebensbedrohlich, 'secondary'),
    ]
  },
  observables: ({ x }) => {
    // the first day on which the count has reached a level
    const day = (level: number) => {
      const n = x.findIndex((v) => v >= level)
      return n < 0 ? null : n * DAYS_PER_CYCLE
    }
    const top = x.reduce((m, v) => Math.max(m, v), 0)
    const peak = x.indexOf(top)
    const gone = x.findIndex((v, n) => n > peak && v === 0)
    const mark = (d: number | null) => (d === null ? [] : [{ kind: 'time' as const, t: d }])
    const at = (level: number, what: string) =>
      quantity(`${what} ab Tag`, day(level), { digits: 3, note: 'nicht erreicht', marks: mark(day(level)) })
    return {
      nachweisbar: at(LEVELS.nachweisbar, 'nachweisbar'),
      fieber: at(LEVELS.fieber, 'Fieber'),
      lebensbedrohlich: at(LEVELS.lebensbedrohlich, 'lebensbedrohlich'),
      verschwunden: quantity('Parasiten verschwunden ab Tag', gone < 0 ? null : gone * DAYS_PER_CYCLE, {
        digits: 3,
        note: 'nicht im Zeitfenster',
        info: 'Sobald rechnerisch weniger als ein Parasit übrig ist, ist das Blut frei davon.',
        marks: mark(gone < 0 ? null : gone * DAYS_PER_CYCLE),
      }),
    }
  },
})

export default defineApplet({
  id: 'malaria',
  model,
  horizon: 'N',
  scenariosOnly: true,
  plots: [
    {
      type: 'timeSeriesDiscrete',
      title: 'Parasiten im Blut',
      xLabel: '\\text{Tage}',
      yLabel: '\\text{Parasiten}',
      yScale: 'log',
      yLogRange: [1, 1e13],
      logToggle: true,
      logHilfe: 'Auf dieser Achse wird aus dem Wachstum eine Gerade, denn jeder Zyklus multipliziert mit demselben Faktor.',
    },
  ],
  readouts: ['nachweisbar', 'fieber', 'lebensbedrohlich', 'verschwunden'],
  scenarios: [
    { label: 'ohne Behandlung', text: 'Alle zwei Tage achtmal so viele Parasiten. Eine Woche lang merkt man nichts, dann geht es sehr schnell.', params: {} },
    { label: 'Behandlung bei Fieber', text: 'Sobald Fieber auftritt, wirkt ein Medikament (Artemisinin). Jeder Zyklus teilt die Zahl der Parasiten nun durch etwa 10 000.', params: { treat: 'fever', N: 10 } },
    { label: 'zu späte Behandlung', text: 'Das Medikament kommt erst, wenn die Krankheit schon lebensbedrohlich ist. Die Parasiten verschwinden auch dann, aber der Körper war lange schwer belastet.', params: { treat: 'late', N: 11 } },
    { label: 'mehr Stiche', text: 'Zehnmal so viele Parasiten am Anfang. Das verschiebt alles nur um gut einen Zyklus nach vorn.', params: { x0: 1e6, N: 7 } },
    { label: 'teilweise immun', text: 'Wer schon oft Malaria hatte, bremst die Parasiten: Sie vermehren sich nur etwa zweifach pro Zyklus.', params: { a: 2, N: 18 } },
  ],
})
