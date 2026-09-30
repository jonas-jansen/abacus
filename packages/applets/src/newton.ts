// Newton's method (slides I 57–64): x_{n+1} = x_n − g(x_n)/g'(x_n). Each step replaces g by
// its tangent at x_n and takes the tangent's zero. Near a simple root the number of correct
// digits roughly doubles per step (the slides' example g(x) = e^{−5x} − x from x₀ = 0,05);
// far away it may jump to another root, cycle (x³ − 2x + 2 from 0) or run off (arctan).

import { bisect, choice, detectPeriod, iteration, klasse, liste, real, sample, schritte, zahl } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

interface G {
  label: string
  tex: string
  g: (x: number) => number
  dg: (x: number) => number
  /** Brackets of the real roots (for the exact value). */
  roots: readonly (readonly [number, number])[]
  x: readonly [number, number]
  y: readonly [number, number]
}

const G_FUNKTIONEN = {
  e5: { label: '$e^{-5x} - x$', tex: 'e^{-5x} - x', g: (x) => Math.exp(-5 * x) - x, dg: (x) => -5 * Math.exp(-5 * x) - 1, roots: [[0, 1]], x: [-0.2, 0.8], y: [-0.8, 1.5] },
  e1: { label: '$e^{-x} - x$', tex: 'e^{-x} - x', g: (x) => Math.exp(-x) - x, dg: (x) => -Math.exp(-x) - 1, roots: [[0, 1]], x: [-1, 3], y: [-3, 2.5] },
  quadrat: { label: '$x^2 - 2$', tex: 'x^2 - 2', g: (x) => x * x - 2, dg: (x) => 2 * x, roots: [[-2, -1], [1, 2]], x: [-3, 3], y: [-3, 7] },
  kubisch: { label: '$x^3 - 2x + 2$', tex: 'x^3 - 2x + 2', g: (x) => x ** 3 - 2 * x + 2, dg: (x) => 3 * x * x - 2, roots: [[-2, -1.5]], x: [-2.5, 2], y: [-6, 8] },
  arctan: { label: '$\\arctan x$', tex: '\\arctan x', g: Math.atan, dg: (x) => 1 / (1 + x * x), roots: [[-1, 1]], x: [-6, 6], y: [-2, 2] },
} satisfies Record<string, G>

type GId = keyof typeof G_FUNKTIONEN
/** The roots to full precision: bisection, then a few Newton steps. */
const WURZELN = Object.fromEntries(
  Object.entries(G_FUNKTIONEN).map(([id, f]) => [
    id,
    f.roots.map(([a, b]) => {
      let r = bisect(f.g, a, b)
      for (let k = 0; k < 4; k++) r -= f.g(r) / f.dg(r)
      return r
    }),
  ]),
) as Record<GId, number[]>

/** The root x_n is heading for: the nearest one (after the run, the last iterate decides). */
const nearestRoot = (id: GId, x: number) => WURZELN[id].reduce((best, r) => (Math.abs(r - x) < Math.abs(best - x) ? r : best), WURZELN[id][0])

/** Correct decimal digits of x as an approximation of r, capped at double precision. */
const digits = (x: number, r: number) => {
  const e = Math.abs(x - r)
  return !Number.isFinite(e) ? 0 : e <= Number.EPSILON * Math.max(1, Math.abs(r)) ? 16 : Math.max(0, Math.min(16, Math.floor(-Math.log10(e / Math.max(1, Math.abs(r))))))
}

const model = iteration({
  id: 'newton',
  params: {
    g: choice(
      'Funktion',
      (Object.keys(G_FUNKTIONEN) as GId[]).map((value) => ({ value, label: G_FUNKTIONEN[value].label })),
      'e5',
    ),
    x0: real('Startwert', { latex: 'x_0', min: -3, max: 3, step: 0.01, default: 0.05 }),
    N: schritte('Schritte', { latex: 'N', default: 6, max: 30 }),
  },
  start: (p) => p.x0,
  step: (x, p) => {
    const f = G_FUNKTIONEN[p.g]
    return x - f.g(x) / f.dg(x)
  },
  horizon: (p) => p.N,
  extraSeries: ({ p, n, x, detail }) => {
    const f = G_FUNKTIONEN[p.g]
    const [lo, hi] = detail?.x ?? [f.x[0] - (f.x[1] - f.x[0]) * 0.5, f.x[1] + (f.x[1] - f.x[0]) * 0.5]
    const graph = sample(f.g, lo, hi, 801)
    // the tangent steps: from (x_n, 0) up to the graph, along the tangent down to (x_{n+1}, 0)
    const tx: number[] = []
    const ty: number[] = []
    for (let k = 0; k + 1 < x.length; k++) {
      if (!Number.isFinite(x[k + 1])) break
      tx.push(x[k], x[k], x[k + 1], NaN)
      ty.push(0, f.g(x[k]), 0, NaN)
    }
    if (!tx.length) tx.push(NaN), ty.push(NaN)
    const r = nearestRoot(p.g, x[x.length - 1])
    return [
      { id: 'graph', label: 'g(x)', kind: 'continuous', x: graph.x, y: graph.y, role: 'primary' },
      { id: 'tangenten', label: 'x_n', name: 'Tangentenschritte', kind: 'continuous', x: Float64Array.from(tx), y: Float64Array.from(ty), role: 'secondary' },
      { id: 'punkte', label: 'x_n', kind: 'discrete', x: x.map((v) => v), y: x.map(() => 0), role: 'secondary', connect: false, legend: false },
      // the error on a log axis; exactly 0 would have no place there
      { id: 'fehler', label: '|x_n - x^*|', kind: 'discrete', x: n, y: x.map((v) => Math.max(Math.abs(v - r), Number.EPSILON * Math.max(1, Math.abs(r)))), role: 'tertiary' },
    ]
  },
  observables: ({ p, x }) => {
    const last = x[x.length - 1]
    const r = nearestRoot(p.g, last)
    const err = Math.abs(last - r)
    const period = detectPeriod(x.subarray(Math.max(0, x.length - 12)), { maxPeriod: 4 })
    const verhalten = !Number.isFinite(last) || Math.abs(last) > 1e6
      ? 'läuft davon'
      : err < 1e-10
        ? 'konvergiert'
        : period !== null && period > 1
          ? `Zyklus der Länge ${period}`
          : 'noch unterwegs'
    const notes: Record<string, string> = {
      'läuft davon': "die Tangente ist fast waagrecht: g'(x_n) ≈ 0 schickt x_{n+1} weit weg",
      'noch unterwegs': 'mehr Schritte oder ein anderer Startwert',
    }
    return {
      verhalten: klasse('Verhalten', verhalten, notes[verhalten] ? { note: notes[verhalten] } : {}),
      nullstelle: zahl('Nullstelle $x^*$', r, { digits: 12, marks: [{ kind: 'point', x: r, y: 0, in: 'map' }] }),
      stellen: liste('richtige Stellen je Schritt', [...x].map((v) => digits(v, r)), {
        marks: [...x].map((v, item) => ({ kind: 'point', x: item, y: Math.max(Math.abs(v - r), Number.EPSILON), in: 'time', item })),
      }),
    }
  },
})

export default defineApplet({
  id: 'newton',
  titel: 'Newton-Verfahren',
  kurz: 'Die Tangente statt der Kurve: ihre Nullstelle ist der nächste Schritt.',
  kapitel: 'I',
  folien: '57–64',
  model,
  horizont: 'N',
  formeln: [
    { label: 'Vorschrift', tex: String.raw`x_{n+1} = x_n - \frac{g(x_n)}{g'(x_n)}` },
    { label: 'Funktion', tex: String.raw`g(x) = {{g}}` },
    { label: 'Start', tex: String.raw`x_0 = {{#x0}}` },
  ],
  plots: [
    {
      type: 'functionGraph',
      series: ['graph', 'tangenten', 'punkte'],
      xLabel: 'x',
      yLabel: 'g(x)',
      x: (p) => G_FUNKTIONEN[p.g].x,
      y: (p) => G_FUNKTIONEN[p.g].y,
      drag: { param: 'x0', axis: 'x' },
    },
    {
      type: 'timeSeriesDiscrete',
      series: ['fehler'],
      title: 'Fehler',
      xLabel: 'n',
      yLabel: '|x_n - x^*|',
      yScale: 'log',
      yLogRange: [1e-17, 10],
      logToggle: true,
      logHilfe: 'Jede Zehnerpotenz weiter unten ist eine richtige Stelle mehr. Nahe der Nullstelle fallen die Punkte immer steiler: die Zahl der richtigen Stellen verdoppelt sich ungefähr in jedem Schritt.',
    },
  ],
  anzeige: ['verhalten', 'nullstelle', 'stellen'],
  szenarien: [
    { label: 'Folie 64', text: 'g(x) = e⁻⁵ˣ − x ab x₀ = 0,05: rasche Konvergenz', params: { g: 'e5', x0: 0.05, N: 6 } },
    { label: 'Zyklus', text: 'x³ − 2x + 2 ab x₀ = 0: springt zwischen 0 und 1 hin und her', params: { g: 'kubisch', x0: 0, N: 12 } },
    { label: 'läuft davon', text: 'arctan x ab x₀ = 1,5: jeder Schritt wirft weiter hinaus', params: { g: 'arctan', x0: 1.5, N: 6 } },
  ],
})
