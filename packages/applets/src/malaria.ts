// Malaria parasites in the blood, as on the lecture slide (apps/malaria_app.m): on day 0 one
// red blood cell is infected; in each infected cell the parasite multiplies, the cell bursts
// and 8 new parasites are set free. So x_{n+1} = 8 x_n, x_0 = 1, n in days (a simplification:
// for malaria tropica one such cycle takes 48 hours).
//
// Reference levels for the whole body (about 5 L of blood, 2.5·10¹³ red blood cells):
//   10⁸    seen under the microscope (about 20 per µL)
//   10⁹    fever in people without immunity
//   10¹¹   life-threatening: a few percent of the red blood cells infected
// An artemisinin drug cuts the number about 10 000-fold per 48 hours, so about 100-fold a day
// here; fewer than one parasite counts as cleared.
//
// The axes follow the timeline (as in the MATLAB app): the first four days fill the picture,
// then the axes grow with the sequence, so each new day squashes the ones before it. An arrow
// shows the step just taken, as in the geometric progression: "· 8" from yesterday to today.

import { choice, iteration, quantity, real, steps, type Series } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

type Treat = 'none' | 'fever' | 'late'
type P = { x0: number; a: number; treat: Treat; N: number }

const LEVELS = { nachweisbar: 1e8, fieber: 1e9, lebensbedrohlich: 1e11 }
/** The drug's factor per day. */
const DRUG = 1e-2

/** From which day on the drug works: the first count at or above the scenario's level. */
const startsTreatment = (x: number, p: P) => (p.treat === 'fever' && x >= LEVELS.fieber) || (p.treat === 'late' && x >= LEVELS.lebensbedrohlich)

const model = iteration({
  id: 'malaria',
  params: {
    x0: real('Parasiten am Tag 0', { latex: 'x_0', min: 1, max: 1000, step: 1, default: 1 }),
    a: real('Faktor pro Tag', { latex: 'a', min: 1, max: 20, step: 0.5, default: 8 }),
    treat: choice('Behandlung', [{ value: 'none', label: 'keine' }, { value: 'fever', label: 'bei Fieber' }, { value: 'late', label: 'spät' }], 'none'),
    N: steps('Tage', { latex: 'N', default: 10, max: 40 }),
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
  series: { label: 'x_n', name: 'Parasiten im Blut' },
  extraSeries: ({ p }) => {
    // dashed, so no level is taken for a curve of data
    const line = (id: string, name: string, v: number, role: Series['role']): Series => ({ id, label: '', name, kind: 'continuous', x: Float64Array.of(0, p.N), y: Float64Array.of(v, v), role, dash: [5, 4] })
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
      return n < 0 ? null : n
    }
    const top = x.reduce((m, v) => Math.max(m, v), 0)
    const peak = x.indexOf(top)
    const gone = x.findIndex((v, n) => n > peak && v === 0)
    const mark = (d: number | null) => (d === null ? [] : [{ kind: 'time' as const, t: d }])
    const at = (level: number, what: string) => quantity(`${what} ab Tag`, day(level), { digits: 3, note: 'nicht erreicht', marks: mark(day(level)) })
    return {
      nachweisbar: at(LEVELS.nachweisbar, 'nachweisbar'),
      fieber: at(LEVELS.fieber, 'Fieber'),
      lebensbedrohlich: at(LEVELS.lebensbedrohlich, 'lebensbedrohlich'),
      verschwunden: quantity('Parasiten verschwunden ab Tag', gone < 0 ? null : gone, {
        digits: 3,
        note: 'nicht im Zeitfenster',
        info: 'Sobald rechnerisch weniger als ein Parasit übrig ist, ist das Blut frei davon.',
        marks: mark(gone < 0 ? null : gone),
      }),
    }
  },
})

export default defineApplet({
  id: 'malaria',
  model,
  horizon: 'N',
  scenariosOnly: true,
  // opens on day 0, like the slide; play or step to see the days pass
  stepwise: true,
  plots: [
    {
      type: 'timeSeriesDiscrete',
      series: ['x', 'nachweisbar', 'fieber', 'lebensbedrohlich'],
      title: 'Parasiten im Blut',
      xLabel: 'n \\text{ (Tage)}',
      yLabel: 'x_n',
      followTimeline: 4,
      // the step just taken: from yesterday's count to today's, with its factor
      guides: (_p, { step, run }) => {
        const x = run.series.find((s) => s.id === 'x')?.y
        if (!x || step < 1 || !(x[step - 1] > 0) || !(x[step] > 0)) return []
        const f = x[step] / x[step - 1]
        const factor = f >= 1 ? String(Math.round(f * 100) / 100) : String.raw`\tfrac{1}{${Math.round(1 / f)}}`
        return [{ kind: 'factor', from: [step - 1, x[step - 1]], to: [step, x[step]], label: String.raw`\cdot ${factor}` }]
      },
      logToggle: true,
      logHilfe: 'Auf dieser Achse wird aus dem Wachstum eine Gerade, denn jeder Tag multipliziert mit demselben Faktor.',
    },
  ],
  readouts: ['nachweisbar', 'fieber', 'lebensbedrohlich', 'verschwunden'],
  scenarios: [
    { label: 'ohne Behandlung', text: 'Jeden Tag achtmal so viele Parasiten. Eine Woche lang merkt man nichts, dann geht es sehr schnell.', params: {} },
    { label: 'Behandlung bei Fieber', text: 'Sobald Fieber auftritt, wirkt ein Medikament (Artemisinin). Jeder Tag teilt die Zahl der Parasiten nun durch etwa 100.', params: { treat: 'fever', N: 16 } },
    { label: 'zu späte Behandlung', text: 'Das Medikament kommt erst, wenn die Krankheit schon lebensbedrohlich ist. Die Parasiten verschwinden auch dann, aber der Körper war lange schwer belastet.', params: { treat: 'late', N: 20 } },
    { label: 'mehr Stiche', text: 'Zehn befallene Zellen statt einer am Anfang. Das verschiebt alles nur um gut einen Tag nach vorn.', params: { x0: 10 } },
    { label: 'teilweise immun', text: 'Wer schon oft Malaria hatte, bremst die Parasiten: Sie verdoppeln sich nur noch jeden Tag.', params: { a: 2, N: 32 } },
  ],
})
