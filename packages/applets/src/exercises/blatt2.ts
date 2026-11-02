// Übungsblatt 2 (WS 2026/27): one scenario applet per exercise, for the exercise class, as
// for sheet 1. They show the sequences, not the solutions' working. Registered in ../index.ts,
// not in the gallery.

import { bool, iteration, iterationN, steps, type Run, type Series } from '@abacus/applet-core'
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
      formel: bool('Lösungsformel', { default: false, labelOn: 'an', labelOff: 'aus' }),
      N: steps('Schritte', { latex: 'N', default: 4, max: 40 }),
    },
    start: () => 1,
    step: (c, _p, n) => factor(n) * c,
    horizon: (p) => p.N,
    series: { label: 'c_n', name: 'Zelldichte' },
    // the given formula 2ⁿ/(n + 1) as a curve through the points, to compare (part b)
    extraSeries: ({ p }) => {
      if (!p.formel) return []
      const x = Float64Array.from({ length: 200 }, (_, i) => (p.N * i) / 199)
      return [{ id: 'formel', label: String.raw`\frac{2^n}{n+1}`, name: 'Lösungsformel', kind: 'continuous', x, y: x.map((t) => 2 ** t / (t + 1)), role: 'reference', dash: [5, 4] } satisfies Series]
    },
  }),
  horizon: 'N',
  scenariosOnly: true,
  stepwise: true,
  formulas: [
    { label: 'Vorschrift', tex: String.raw`c_{n+1} = \frac{2(n+1)}{n+2}\,c_n` },
    { label: 'Start', tex: String.raw`c_0 = 1` },
  ],
  plots: [
    {
      type: 'timeSeriesDiscrete',
      series: ['x', 'formel'],
      xLabel: 'n',
      yLabel: 'c_n \\text{ (Mio. Zellen/ml)}',
      logToggle: true,
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
    { label: 'c₀ … c₄', text: 'Die ersten fünf Werte.', params: { formel: false, N: 4 } },
    { label: 'mit Lösungsformel', text: 'Die Formel 2ⁿ/(n + 1) als Kurve durch die Punkte.', params: { formel: true, N: 4 } },
    { label: 'weiter', text: 'Wie geht es weiter? 15 Schritte.', params: { formel: false, N: 15 } },
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
    params: { N: steps('Jahre', { latex: 'N', default: 2, max: 30 }) },
    // the state (x_n, x_{n+1}): a recursion of second order needs both
    components: [
      { id: 'x', label: 'x_n', name: 'blühende Pflanzen', role: 'primary' },
      { id: 'next', label: 'x_{n+1}', role: 'reference' },
    ],
    start: () => [10, 20],
    step: ([x, next]) => [next, 2 * next + 3 * x],
    horizon: (p) => p.N,
  }),
  horizon: 'N',
  scenariosOnly: true,
  stepwise: true,
  formulas: [
    { label: 'Start', tex: String.raw`x_0 = 10` },
    { label: 'jede Pflanze', tex: String.raw`\text{2 Pflanzen im nächsten, 3 im übernächsten Jahr}` },
  ],
  plots: [
    {
      type: 'timeSeriesDiscrete',
      series: ['x'],
      xLabel: 'n \\text{ (Jahre)}',
      yLabel: 'x_n',
      logToggle: true,
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
    { label: 'x₀ … x₂', text: 'Teil a).', params: { N: 2 } },
    { label: 'x₀ … x₅', text: 'Teil b).', params: { N: 5 } },
    { label: 'weiter', text: 'Wie geht es weiter? 15 Jahre.', params: { N: 15 } },
  ],
})

export const blatt2: AppletModule<any>[] = [zellkultur, mohn]
