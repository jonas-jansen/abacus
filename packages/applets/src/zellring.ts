// A ring of N = 50 heart cells (slides II 66–72). Each cell follows the action-potential map
// of II 61 with b = 0,6 (at rest, but excitable); neighbours are coupled through f₁ with
// strength d:
//   y₁ⁱ(n+1) = (1 − d) f₁(yⁱ) + d/2 (f₁(yⁱ⁺¹) + f₁(yⁱ⁻¹)),   y₂ⁱ(n+1) = a y₂ⁱ − b y₁ⁱ + c.
// Cell 1 is excited at n = 0: for d > 0 a wave runs both ways round the ring and dies where
// the two halves meet. A second stimulus (cell 36) decides by its timing: too early, the
// cells are still refractory and nothing happens (n = 37); a little later the new wave can
// only run one way and circles for ever — re-entry (n = 41); later still it runs both ways
// and dies out (n = 45).

import { bool, index, int, iterationN, klasse, real, schritte, type Grid } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

const M = 50
const REIZ = 0.3
type P = { d: number; a: number; b: number; c: number; k: number; zweiter: boolean; zelle: number; n2: number }

const f1 = (y1: number, y2: number, k: number) => y1 * y1 * Math.exp(y2 - y1) + k

/** The resting state of a single cell (where the map settles without stimulus). */
function ruhe(p: P): [number, number] {
  let [y1, y2] = [0.02, p.c / (1 - p.a)]
  for (let i = 0; i < 3000; i++) [y1, y2] = [f1(y1, y2, p.k), p.a * y2 - p.b * y1 + p.c]
  return [y1, y2]
}

const components = Array.from({ length: M }, (_, i) => [
  { id: `u${i + 1}`, label: `y_1^{${i + 1}}`, role: 'primary' as const },
  { id: `v${i + 1}`, label: `y_2^{${i + 1}}`, role: 'secondary' as const },
]).flat()

function schritt(x: readonly number[], p: P, n: number): number[] {
  const y1 = Array.from({ length: M }, (_, i) => x[2 * i])
  if (p.zweiter && n === p.n2) y1[p.zelle - 1] = REIZ
  const F = y1.map((v, i) => f1(v, x[2 * i + 1], p.k))
  const out = new Array<number>(2 * M)
  for (let i = 0; i < M; i++) {
    out[2 * i] = (1 - p.d) * F[i] + (p.d / 2) * (F[(i + 1) % M] + F[(i + M - 1) % M])
    out[2 * i + 1] = p.a * x[2 * i + 1] - p.b * y1[i] + p.c
  }
  return out
}

/** The state after `steps` steps, without the model (for the long-term check). */
function nach(p: P, steps: number): number[] {
  const [r1, r2] = ruhe(p)
  let x = Array.from({ length: M }, () => [r1, r2]).flat()
  x[0] = REIZ
  for (let n = 0; n < steps; n++) x = schritt(x, p, n)
  return x
}

/** Cells above half the height of an action potential. */
const aktiv = (x: readonly number[]) => Array.from({ length: M }, (_, i) => x[2 * i]).filter((v) => v > 1).length

const model = iterationN({
  id: 'zellring',
  params: {
    d: real('Kopplung', { latex: 'd', min: 0, max: 1, step: 0.01, default: 0.4, limits: { min: 0, max: 1, reason: 'd ist der Anteil, der an die Nachbarn geht.' } }),
    zweiter: bool('zweiter Reiz', { default: false, labelOn: 'an', labelOff: 'aus' }),
    zelle: int('Zelle des zweiten Reizes', { latex: 'm', min: 1, max: M, default: 36 }),
    n2: int('Zeitpunkt des zweiten Reizes', { latex: 'n_2', min: 1, max: 200, default: 41 }),
    b: real('Rückkopplung', { latex: 'b', min: 0, max: 1, step: 0.01, default: 0.6 }),
    k: real('Reiz im Ruhezustand', { latex: 'k', min: 0, max: 0.1, step: 0.001, default: 0.02 }),
    a: real('Erholung', { latex: 'a', min: 0, max: 0.99, step: 0.01, default: 0.89, limits: { min: 0, max: 0.999, reason: 'Für 0 < a < 1 gibt es einen Ruhezustand.' } }),
    c: real('Zufluss', { latex: 'c', min: 0, max: 1, step: 0.01, default: 0.28 }),
    N: schritte('Schritte', { latex: 'N', default: 120, max: 1000 }),
  },
  components,
  start: (p) => nach(p, 0), // at rest, cell 1 excited
  step: (x, p, n) => schritt(x, p, n),
  horizon: (p) => p.N,
  grids: ({ n, x }): Grid[] => {
    const nx = n.length
    const z = new Float64Array(nx * M)
    for (let j = 0; j < M; j++) for (let i = 0; i < nx; i++) z[j * nx + i] = x[2 * j][i]
    return [{ id: 'y1', label: 'y_1', x: n, y: Float64Array.from({ length: M }, (_, j) => j + 1), z }]
  },
  observables: ({ p, x }) => {
    const last = x[0].length - 1
    const jetzt = aktiv(x.map((c) => c[last]))
    // whether the excitation lasts: a longer run
    const bleibt = aktiv(nach(p, 400)) > 0
    return {
      erregung: klasse('Die Erregung', bleibt ? 'kreist weiter (Reentry)' : 'erlischt', {
        note: bleibt ? 'eine Welle läuft immer wieder um den Ring' : undefined,
      }),
      aktiv: index('erregte Zellen bei $N$', jetzt),
    }
  },
})

export default defineApplet({
  id: 'zellring',
  model,
  horizont: 'N',
  formeln: [
    {
      label: 'Zelle i',
      tex: String.raw`y_1^i(n+1) = (1 - {{d}})\,f_1(\mathbf{y}^i) + \frac{{{d}}}{2}\bigl(f_1(\mathbf{y}^{i+1}) + f_1(\mathbf{y}^{i-1})\bigr) \\ y_2^i(n+1) = {{a}}{{*}}y_2^i(n) - {{b}}{{*}}y_1^i(n) + {{c}}`,
    },
    { label: 'Anregung', tex: String.raw`f_1(\mathbf{y}) = y_1^2\,e^{y_2 - y_1} + {{k}} \\ \text{Zelle } {{zelle}} \text{ bei } n = {{n2}}\text{: } {{zweiter}}` },
  ],
  plots: [
    { type: 'heatmap', grid: 'y1', title: 'Erregung über die Zeit', xLabel: 'n', yLabel: '\\text{Zelle } i', zLabel: 'y_1', zRange: [0, 4.5] },
    { type: 'bars', grid: 'y1', title: 'Der Ring bei n', xLabel: 'i', yLabel: 'y_1^i', y: [0, 5] },
  ],
  layout: { main: ['d', 'zweiter', 'n2'], sichtbar: { zelle: (p) => p.zweiter, n2: (p) => p.zweiter } },
  anzeige: ['erregung', 'aktiv'],
  szenarien: [
    { label: 'ohne Kopplung', text: 'd = 0: nur Zelle 1 feuert (Folie 68)', params: { d: 0 } },
    { label: 'eine Welle', text: 'd = 0,4: die Welle läuft in beide Richtungen und erlischt (Folie 69)', params: {} },
    { label: 'Szenario I', text: 'zweiter Reiz bei n = 37: die Zellen sind noch refraktär (Folie 70)', params: { zweiter: true, n2: 37 } },
    { label: 'Szenario II', text: 'bei n = 45: eine zweite Welle, die ebenfalls erlischt (Folie 71)', params: { zweiter: true, n2: 45 } },
    { label: 'Szenario III', text: 'bei n = 41: die Welle läuft nur in eine Richtung – Reentry (Folie 72)', params: { zweiter: true, n2: 41 } },
  ],
})
