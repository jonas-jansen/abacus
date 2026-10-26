// Übungsblatt 1 (WS 2026/27): one scenario applet per part, for the exercise class. They
// show the sequences, not the solutions' working; each scenario is what a part asks for
// ("n = 0 … 4") or a look further ahead. Registered in ./index.ts, not in the gallery.

import { choice, iteration, real, steps, type Run, type Series } from '@abacus/applet-core'
import { defineApplet, type AppletModule, type Guide } from '@abacus/applet-ui/define'

/** An arrow for the step just taken (as in the malaria applet), with a fixed label. */
const stepArrow =
  (label: string) =>
  (_p: unknown, { step, run }: { step: number; run: Run }): readonly Guide[] => {
    const x = run.series[0]?.y
    const n = Math.min(step, (x?.length ?? 0) - 1)
    if (!x || n < 1) return []
    return [{ kind: 'factor', from: [n - 1, x[n - 1]], to: [n, x[n]], label, above: true }]
  }

// ---------------------------------------------------------------------------------- 1.1

const sonnenblume = defineApplet({
  id: 'blatt1-sonnenblume',
  title: 'Höhe einer Sonnenblume',
  summary: 'h_n = 5 + 3n',
  chapter: 'I',
  model: iteration({
    id: 'blatt1-sonnenblume',
    params: { N: steps('Wochen', { latex: 'N', default: 4, max: 60 }) },
    start: () => 5,
    step: (h) => h + 3,
    horizon: (p) => p.N,
    series: { label: 'h_n', name: 'Höhe' },
  }),
  horizon: 'N',
  scenariosOnly: true,
  stepwise: true,
  formulas: [{ label: 'Höhe nach n Wochen', tex: String.raw`h_n = 5 + 3n` }],
  plots: [
    {
      type: 'timeSeriesDiscrete',
      xLabel: 'n \\text{ (Wochen)}',
      yLabel: 'h_n \\text{ (cm)}',
      // the week just passed as a slope triangle, as in the arithmetic progression
      guides: (p, { step }) => {
        const n = Math.min(step, p.N)
        return n < 1 ? [] : [{ kind: 'rise', from: [n - 1, 5 + 3 * (n - 1)], to: [n, 5 + 3 * n], label: '+3', run: '1' }]
      },
    },
  ],
  scenarios: [
    { label: 'n = 0 … 4', text: 'Die ersten fünf Glieder.', params: { N: 4 } },
    { label: 'ein halbes Jahr', text: 'Wie geht es weiter? 26 Wochen.', params: { N: 26 } },
  ],
})

const wirkstoff = defineApplet({
  id: 'blatt1-wirkstoff',
  title: 'Wirkstoffmenge im Blut',
  summary: 'c_n = 100 · 0.8^n',
  chapter: 'I',
  model: iteration({
    id: 'blatt1-wirkstoff',
    params: { N: steps('Stunden', { latex: 'N', default: 4, max: 72 }) },
    start: () => 100,
    step: (c) => 0.8 * c,
    horizon: (p) => p.N,
    series: { label: 'c_n', name: 'Wirkstoff' },
  }),
  horizon: 'N',
  scenariosOnly: true,
  stepwise: true,
  formulas: [{ label: 'Wirkstoff nach n Stunden', tex: String.raw`c_n = 100 \cdot 0.8^n` }],
  plots: [{ type: 'timeSeriesDiscrete', xLabel: 'n \\text{ (Stunden)}', yLabel: 'c_n \\text{ (mg)}', guides: stepArrow(String.raw`\cdot 0.8`) }],
  scenarios: [
    { label: 'n = 0 … 4', text: 'Die ersten fünf Glieder.', params: { N: 4 } },
    { label: 'ein Tag', text: 'Wie geht es weiter? 24 Stunden.', params: { N: 24 } },
  ],
})

const insekten = defineApplet({
  id: 'blatt1-insekten',
  title: 'Insektenpopulation mit zweijährigem Zyklus',
  summary: 'x_n = 500 + 300 · (−1)^n',
  chapter: 'I',
  model: iteration({
    id: 'blatt1-insekten',
    params: { N: steps('Jahre', { latex: 'N', default: 4, max: 40 }) },
    start: () => 800,
    // 500 + 300·(−1)ⁿ: 800, 200, 800, …
    step: (x) => 1000 - x,
    horizon: (p) => p.N,
    series: { label: 'x_n', name: 'Insekten' },
  }),
  horizon: 'N',
  scenariosOnly: true,
  stepwise: true,
  formulas: [{ label: 'Population nach n Jahren', tex: String.raw`x_n = 500 + 300 \cdot (-1)^n` }],
  plots: [{ type: 'timeSeriesDiscrete', xLabel: 'n \\text{ (Jahre)}', yLabel: 'x_n', y: [0, 1000] }],
  scenarios: [
    { label: 'n = 0 … 4', text: 'Die ersten fünf Glieder.', params: { N: 4 } },
    { label: 'zwölf Jahre', text: 'Wie geht es weiter?', params: { N: 12 } },
  ],
})

// ------------------------------------------------------------------------- 1.2 and 1.3

type Start = 'half' | 'one' | 'two' | 'all'
const STARTS = { half: 0.5, one: 1, two: 2 } as const
const START_TEX = { half: String.raw`\tfrac12`, one: '1', two: '2' } as const
const ROLES = { half: 'primary', one: 'secondary', two: 'tertiary' } as const
const bh = (x: number) => (2 * x) / (1 + x)

/** Beverton–Holt for one start value or all three in one picture. */
const bevertonHolt = (id: string) =>
  iteration({
    id,
    params: {
      start: choice('Startwert', [{ value: 'half', label: '1/2' }, { value: 'one', label: '1' }, { value: 'two', label: '2' }, { value: 'all', label: 'alle' }], 'half'),
      N: steps('Jahre', { latex: 'N', default: 3, max: 30 }),
    },
    start: (p) => STARTS[p.start === 'all' ? 'half' : (p.start as Exclude<Start, 'all'>)],
    step: (x) => bh(x),
    horizon: (p) => p.N,
    // the sequences drawn: one per start value shown (the run's own orbit drives the timeline)
    extraSeries: ({ p, n }) =>
      (Object.keys(STARTS) as (keyof typeof STARTS)[])
        .filter((s) => p.start === 'all' || p.start === s)
        .map((s): Series => {
          const y = new Float64Array(n.length)
          y[0] = STARTS[s]
          for (let k = 1; k < y.length; k++) y[k] = bh(y[k - 1])
          return { id: s, label: String.raw`x_0 = ${START_TEX[s]}`, kind: 'discrete', x: n, y, role: ROLES[s] }
        }),
  })

const bhFormulas = (p: { start: Start }) => [
  { label: 'Vorschrift', tex: String.raw`x_{n+1} = \frac{2x_n}{1 + x_n}` },
  { label: 'Start', tex: p.start === 'all' ? String.raw`x_0 = \tfrac12,\ 1,\ 2` : String.raw`x_0 = ${START_TEX[p.start]}` },
]
const bhPlot = { type: 'timeSeriesDiscrete' as const, series: ['half', 'one', 'two'], xLabel: 'n \\text{ (Jahre)}', yLabel: 'x_n \\text{ (Tausend Fische)}', y: [0, 2.2] as [number, number] }

const fische = defineApplet({
  id: 'blatt1-fische',
  title: 'Fischpopulation nach Beverton und Holt',
  summary: 'x_{n+1} = 2x_n / (1 + x_n)',
  chapter: 'I',
  model: bevertonHolt('blatt1-fische'),
  horizon: 'N',
  scenariosOnly: true,
  stepwise: true,
  formulas: bhFormulas,
  plots: [bhPlot],
  scenarios: [
    { label: 'a) x₀ = 1/2', params: { start: 'half', N: 3 } },
    { label: 'b) x₀ = 1', params: { start: 'one', N: 3 } },
    { label: 'c) x₀ = 2', params: { start: 'two', N: 3 } },
    { label: 'd) alle drei', text: 'Die drei Folgen in einem Bild.', params: { start: 'all', N: 3 } },
    { label: 'd) weiter', text: 'Die drei Folgen über zwölf Jahre.', params: { start: 'all', N: 12 } },
  ],
})

const fischeFormel = defineApplet({
  id: 'blatt1-fische-formel',
  title: 'Beverton–Holt mit Startwert 1/2',
  summary: 'x_{n+1} = 2x_n / (1 + x_n), x_0 = 1/2',
  chapter: 'I',
  model: bevertonHolt('blatt1-fische-formel'),
  horizon: 'N',
  scenariosOnly: true,
  stepwise: true,
  formulas: bhFormulas,
  plots: [bhPlot],
  scenarios: [
    { label: 'x₀ … x₃', text: 'Die Werte, aus denen die Formel erraten wird.', params: { start: 'half', N: 3 } },
    { label: 'weiter', text: 'Wie geht es weiter? 15 Jahre.', params: { start: 'half', N: 15 } },
  ],
})

// ---------------------------------------------------------------------------------- 1.4

const ecoli = defineApplet({
  id: 'blatt1-ecoli',
  title: 'Escherichia coli',
  summary: 'Verdopplung alle 20 Minuten',
  chapter: 'I',
  model: iteration({
    id: 'blatt1-ecoli',
    params: { N: steps('Zeitschritte', { latex: 'N', default: 6, max: 40 }) },
    start: () => 2,
    step: (x) => 2 * x,
    horizon: (p) => p.N,
    series: { label: 'x_n', name: 'Bakterien' },
  }),
  horizon: 'N',
  scenariosOnly: true,
  stepwise: true,
  formulas: [{ label: 'Bakterien nach n Schritten zu je 20 Minuten', tex: String.raw`x_0 = 2,\quad \text{Verdopplung alle 20 Minuten}` }],
  plots: [
    {
      type: 'timeSeriesDiscrete',
      xLabel: 'n \\text{ (je 20 Minuten)}',
      yLabel: 'x_n',
      // as for malaria: the first steps fill the picture, then the axes grow
      followTimeline: 4,
      logToggle: true,
      guides: stepArrow(String.raw`\cdot 2`),
    },
  ],
  scenarios: [
    { label: '2 Stunden', text: 'Sechs Schritte zu je 20 Minuten.', params: { N: 6 } },
    { label: '6 Stunden', text: '18 Schritte zu je 20 Minuten.', params: { N: 18 } },
  ],
})

// ---------------------------------------------------------------------------------- 1.5

const welse = defineApplet({
  id: 'blatt1-welse',
  title: 'Welse im Teich',
  summary: '8 % Zuwachs im Monat, 300 Fische gefangen',
  chapter: 'I',
  model: iteration({
    id: 'blatt1-welse',
    params: {
      fang: real('Fang pro Monat', { latex: 'f', min: 0, max: 1000, step: 10, default: 300 }),
      N: steps('Monate', { latex: 'N', default: 6, max: 60 }),
    },
    start: () => 5000,
    step: (x, p) => Math.max(0, 1.08 * x - p.fang),
    horizon: (p) => p.N,
    series: { label: 'x_n', name: 'Welse' },
  }),
  horizon: 'N',
  scenariosOnly: true,
  stepwise: true,
  formulas: [
    { label: 'Start', tex: String.raw`x_0 = 5000` },
    { label: 'jeden Monat', tex: String.raw`\text{8 \% mehr, dann } {{#fang}} \text{ gefangen}` },
  ],
  plots: [
    {
      type: 'timeSeriesDiscrete',
      xLabel: 'n \\text{ (Monate)}',
      yLabel: 'x_n',
      guides: (p: { fang: number }, at: { step: number; run: Run }) => stepArrow(p.fang ? String.raw`\cdot 1.08 - ${p.fang}` : String.raw`\cdot 1.08`)(p, at),
    },
  ],
  scenarios: [
    { label: '6 Monate', text: 'Die Frage der Aufgabe.', params: { N: 6 } },
    { label: 'zwei Jahre', text: 'Wie geht es weiter?', params: { N: 24 } },
    { label: 'ohne Fang', text: 'Zum Vergleich: kein Fisch wird gefangen.', params: { fang: 0, N: 24 } },
    { label: '400 im Monat', text: 'Zum Vergleich: 400 Fische gefangen.', params: { fang: 400, N: 24 } },
  ],
})

export const blatt1: AppletModule<any>[] = [sonnenblume, wirkstoff, insekten, fische, fischeFormel, ecoli, welse]
