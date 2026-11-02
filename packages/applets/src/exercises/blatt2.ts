// Übungsblatt 2 (WS 2026/27): one scenario applet per exercise, for the exercise class, as
// for sheet 1. They show the sequences, not the solutions' working. Registered in ../index.ts,
// not in the gallery.

import { bool, iteration, iterationN, real, steps, type Run, type Series } from '@abacus/applet-core'
import { defineApplet, type AppletModule, type Guide } from '@abacus/applet-ui/define'

// ---------------------------------------------------------------------------------- 2.1

/** The factor of step n → n + 1: 2(n + 1)/(n + 2). */
const factor = (n: number) => (2 * (n + 1)) / (n + 2)

const zellkultur = defineApplet({
  id: 'blatt2-zellkultur',
  title: 'Zellkultur mit Verdünnung',
  summary: 'c_{n+1} = 2(n+1)/(n+2) c_n',
  chapter: 'I',
  model: iteration({
    id: 'blatt2-zellkultur',
    params: {
      c0: real('Startwert', { latex: 'c_0', min: 0, max: 5, step: 0.05, default: 1 }),
      formel: bool('Lösungsformel', { default: false, labelOn: 'an', labelOff: 'aus' }),
      N: steps('Schritte', { latex: 'N', default: 4, max: 40 }),
    },
    start: (p) => p.c0,
    step: (c, _p, n) => factor(n) * c,
    horizon: (p) => p.N,
    series: { label: 'c_n', name: 'Zelldichte' },
    // the given formula 2ⁿ/(n + 1) as a curve through the points, to compare (part b)
    extraSeries: ({ p }) => {
      if (!p.formel) return []
      const x = Float64Array.from({ length: 200 }, (_, i) => (p.N * i) / 199)
      // with another start the formula scales: c_0 · 2ⁿ/(n + 1)
      const label = p.c0 === 1 ? String.raw`\frac{2^n}{n+1}` : String.raw`${+p.c0.toFixed(2)} \cdot \frac{2^n}{n+1}`
      return [{ id: 'formel', label, name: 'Lösungsformel', kind: 'continuous', x, y: x.map((t) => (p.c0 * 2 ** t) / (t + 1)), role: 'reference', dash: [5, 4] } satisfies Series]
    },
  }),
  horizon: 'N',
  scenariosOnly: true,
  stepwise: true,
  formulas: [
    { label: 'Vorschrift', tex: String.raw`c_{n+1} = \frac{2(n+1)}{n+2}\,c_n` },
    { label: 'Start', tex: String.raw`c_0 = {{#c0}}` },
  ],
  plots: [
    {
      type: 'timeSeriesDiscrete',
      series: ['x', 'formel'],
      xLabel: 'n',
      yLabel: 'c_n \\text{ (Mio. Zellen/ml)}',
      logToggle: true,
      drag: { param: 'c0', axis: 'y' },
      // the step just taken, with its own factor: · 1, · 4/3, · 3/2, · 8/5, …
      guides: (_p: unknown, { step, run }: { step: number; run: Run }): readonly Guide[] => {
        const x = run.series[0]?.y
        const n = Math.min(step, (x?.length ?? 0) - 1)
        if (!x || n < 1) return []
        const [num, den] = [2 * n, n + 1]
        const g = gcd(num, den)
        const label = den / g === 1 ? String.raw`\cdot ${num / g}` : String.raw`\cdot \tfrac{${num / g}}{${den / g}}`
        return [{ kind: 'factor', from: [n - 1, x[n - 1]], to: [n, x[n]], label, above: true }]
      },
    },
  ],
  scenarios: [
    { label: 'c₀ … c₄', text: 'Die ersten fünf Werte. Den Startwert kann man im Bild ziehen.', params: { c0: 1, formel: false, N: 4 } },
    { label: 'mit Lösungsformel', text: 'Die Formel 2ⁿ/(n + 1) als Kurve durch die Punkte.', params: { c0: 1, formel: true, N: 4 } },
    { label: 'weiter', text: 'Wie geht es weiter? 15 Schritte.', params: { c0: 1, formel: false, N: 15 } },
  ],
})

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

// ---------------------------------------------------------------------------------- 2.2

const mohn = defineApplet({
  id: 'blatt2-mohn',
  title: 'Klatschmohn',
  summary: 'zwei Pflanzen im nächsten, drei im übernächsten Jahr',
  chapter: 'I',
  model: iterationN({
    id: 'blatt2-mohn',
    params: {
      x0: real('Pflanzen im Jahr 0', { latex: 'x_0', min: 0, max: 100, step: 1, default: 10 }),
      x1: real('Pflanzen im Jahr 1', { latex: 'x_1', min: 0, max: 200, step: 1, default: 20 }),
      N: steps('Jahre', { latex: 'N', default: 2, max: 30 }),
    },
    // the state (x_n, x_{n+1}): a recursion of second order needs both
    components: [
      { id: 'x', label: 'x_n', name: 'blühende Pflanzen', role: 'primary' },
      { id: 'next', label: 'x_{n+1}', role: 'reference' },
    ],
    // a recursion of second order has two start values; the sheet's are x₀ = 10, x₁ = 20
    start: (p) => [p.x0, p.x1],
    step: ([x, next]) => [next, 2 * next + 3 * x],
    horizon: (p) => p.N,
  }),
  horizon: 'N',
  scenariosOnly: true,
  stepwise: true,
  formulas: [
    { label: 'Start', tex: String.raw`x_0 = {{#x0}}` },
    { label: 'jede Pflanze', tex: String.raw`\text{2 Pflanzen im nächsten, 3 im übernächsten Jahr}` },
  ],
  plots: [
    {
      type: 'timeSeriesDiscrete',
      series: ['x'],
      xLabel: 'n \\text{ (Jahre)}',
      yLabel: 'x_n',
      logToggle: true,
      drag: [
        { param: 'x0', axis: 'y' },
        { param: 'x1', axis: 'y', at: (p) => [1, p.x1] },
      ],
      // into the new year: from the year before (· 2) and from the one before that (· 3)
      guides: (_p: unknown, { step, run }: { step: number; run: Run }): readonly Guide[] => {
        const x = run.series.find((s) => s.id === 'x')?.y
        const n = Math.min(step, (x?.length ?? 0) - 1)
        if (!x || n < 1) return []
        const out: Guide[] = [{ kind: 'factor', from: [n - 1, x[n - 1]], to: [n, x[n]], label: String.raw`\cdot 2`, above: true }]
        if (n >= 2) out.push({ kind: 'factor', from: [n - 2, x[n - 2]], to: [n, x[n]], label: String.raw`\cdot 3`, above: true })
        return out
      },
    },
  ],
  scenarios: [
    { label: 'x₀ … x₂', text: 'Teil a). Die beiden Startwerte kann man im Bild ziehen.', params: { x0: 10, x1: 20, N: 2 } },
    { label: 'x₀ … x₅', text: 'Teil b).', params: { x0: 10, x1: 20, N: 5 } },
    { label: 'weiter', text: 'Wie geht es weiter? 15 Jahre.', params: { x0: 10, x1: 20, N: 15 } },
  ],
})

export const blatt2: AppletModule<any>[] = [zellkultur, mohn]
