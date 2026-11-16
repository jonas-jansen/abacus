// Übungsblatt 4 (WS 2026/27): fully interactive applets for the exercise class, as for the
// lectures: every parameter can be changed, start values dragged in the picture, and the
// scenarios hold what each part asks for. Switches show what a part is after (the limit of
// x₀ in 4.1 a, the equilibria in 4.1 c), so the picture can be shown before the answer.
// Registered in ../index.ts, not in the gallery.

import { bool, category, choice, closedForm, iteration, list, quantity, real, sample, steps, type Run, type Series } from '@abacus/applet-core'
import { defineApplet, type AppletModule, type Guide } from '@abacus/applet-ui/define'

type Scenarios = { label: string; text?: string; params: Record<string, unknown> }[]

const num = (v: number, d = 4) => String(+v.toFixed(d))
const segment = (id: string, label: string, [x0, y0]: readonly [number, number], [x1, y1]: readonly [number, number], role: Series['role'], extra: Partial<Series> = {}): Series => ({
  id,
  label,
  kind: 'continuous',
  x: Float64Array.of(x0, x1),
  y: Float64Array.of(y0, y1),
  role,
  ...extra,
})
const points = (id: string, label: string, pts: readonly (readonly [number, number])[], role: Series['role'], extra: Partial<Series> = {}): Series => ({
  id,
  label,
  kind: 'discrete',
  x: Float64Array.from(pts.length ? pts.map((q) => q[0]) : [NaN]),
  y: Float64Array.from(pts.length ? pts.map((q) => q[1]) : [NaN]),
  role,
  connect: false,
  ...extra,
})
const seq = (id: string, label: string, y: Float64Array, role: Series['role'], extra: Partial<Series> = {}): Series => ({
  id,
  label,
  kind: 'discrete',
  x: Float64Array.from(y, (_, k) => k),
  y,
  role,
  ...extra,
})
/** Only these parameters are offered; the others keep the scenario's values. */
const only = (shown: readonly string[], all: readonly string[], visible: Record<string, (p: any) => boolean> = {}) => ({
  main: shown,
  visible: { ...Object.fromEntries(all.filter((id) => !shown.includes(id)).map((id) => [id, () => false])), ...visible },
})

// ================================================================ 4.1 und 4.2: Fischbestand

type Modell = 'logistisch' | 'ricker'
type FishP = { modell: Modell; vergleich: boolean; r: number; K: number; x0: number; grenze: boolean; fix: boolean; werte: boolean; N: number }

const MODELLE = { logistisch: 'logistisch', ricker: 'Ricker' } as const
const anderes = (m: Modell): Modell => (m === 'logistisch' ? 'ricker' : 'logistisch')
/** The growth factor per fish: 1 + r(1 − x/K) or e^{r(1 − x/K)}. */
const W = (m: Modell, p: FishP) => (x: number) => (m === 'logistisch' ? 1 + p.r * (1 - x / p.K) : Math.exp(p.r * (1 - x / p.K)))
const F = (m: Modell, p: FishP) => (x: number) => W(m, p)(x) * x
/** One year: from 0 nothing grows; once the stock has died out (x ≤ 0) the sequence ends. */
const jahr = (m: Modell, p: FishP) => (x: number) => (x === 0 ? 0 : x < 0 || !Number.isFinite(x) ? NaN : F(m, p)(x))
const folge = (m: Modell, p: FishP, x0: number, N: number) => {
  const y = new Float64Array(N + 1)
  y[0] = x0
  for (let k = 0; k < N; k++) y[k + 1] = jahr(m, p)(y[k])
  return y
}
const gezeigt = (p: FishP): Modell[] => (p.vergleich ? [p.modell, anderes(p.modell)] : [p.modell])
/** The largest start with x₁ > 0 in the logistic model: where W crosses 0, K(1 + 1/r). */
const grenzwert = (p: FishP) => p.K * (1 + 1 / p.r)

/** The window for x: the sheet's 0 … 2.2 K, wider for a large start or a high peak of f. */
function fischX(p: FishP): number {
  let X = Math.max(2.2 * p.K, 1.15 * p.x0)
  for (const m of gezeigt(p)) {
    const g = sample(F(m, p), 0, X, 400)
    for (const v of g.y) if (Number.isFinite(v)) X = Math.max(X, 1.1 * v)
  }
  return X
}
/** The window for x_n: down to the first negative value (the stock that died out), else just below 0. */
function fischY(p: FishP): [number, number] {
  const X = fischX(p)
  let lo = -0.05 * X
  for (const m of gezeigt(p)) {
    const v = F(m, p)(p.x0)
    if (Number.isFinite(v)) lo = Math.min(lo, 1.1 * v)
  }
  return [Math.max(lo, -1.5 * X), X]
}
/** The window for W: from x = 0 to 3K, as in 4.2 a. */
const wX = (p: FishP): [number, number] => [0, Math.max(3 * p.K, 1.1 * p.x0)]
function wY(p: FishP): [number, number] {
  let [lo, hi] = [0, 1.2]
  for (const m of gezeigt(p))
    for (const v of sample(W(m, p), ...wX(p), 200).y)
      if (Number.isFinite(v)) [lo, hi] = [Math.min(lo, v), Math.max(hi, v)]
  const pad = 0.08 * (hi - lo)
  return [lo - pad, hi + pad]
}

const fischModel = iteration({
  id: 'blatt4-fisch',
  params: {
    modell: choice('Modell', (Object.keys(MODELLE) as Modell[]).map((value) => ({ value, label: MODELLE[value] })), 'logistisch'),
    vergleich: bool('anderes Modell zum Vergleich', { default: false, labelOn: 'an', labelOff: 'aus' }),
    r: real('Wachstumsrate', { latex: 'r', min: 0.1, max: 3, step: 0.01, default: 1.2 }),
    K: real('Tragfähigkeit', { latex: 'K', min: 100, max: 3000, step: 10, default: 1000 }),
    x0: real('Anfangsbestand', { latex: 'x_0', min: 0, max: 5000, step: 1, default: 500 }),
    grenze: bool('Grenze für x₁ ≤ 0', { default: false, labelOn: 'an', labelOff: 'aus' }),
    fix: bool('Gleichgewichtspunkte', { default: false, labelOn: 'an', labelOff: 'aus' }),
    werte: bool('W bei 0, K, 2K, 3K', { default: false, labelOn: 'an', labelOff: 'aus' }),
    N: steps('Jahre', { latex: 'N', default: 3, max: 60 }),
  },
  start: (p) => p.x0,
  step: (x, p) => jahr(p.modell as Modell, p as FishP)(x),
  horizon: (p) => p.N,
  series: { id: 'x', label: 'x_n', name: 'Bestand' },
  extraSeries: ({ p, detail }) => {
    const P = p as FishP
    const m = P.modell
    const o = anderes(m)
    const X = fischX(P)
    const [lo, hi] = detail?.x ?? [0, X]
    const w = hi - lo
    const g = sample(F(m, P), Math.max(0, lo - w), hi + w, 1201)
    const go = sample(F(o, P), Math.max(0, lo - w), hi + w, 1201)
    const [w0, w1] = wX(P)
    const wg = sample(W(m, P), w0, 2 * w1, 801)
    const wgo = sample(W(o, P), w0, 2 * w1, 801)
    const out: Series[] = [
      { id: 'f', label: 'f(x)', name: MODELLE[m], kind: 'continuous', x: g.x, y: g.y, role: 'primary' },
      { id: 'fo', label: 'f(x)', name: MODELLE[o], kind: 'continuous', x: go.x, y: P.vergleich ? go.y : go.y.map(() => NaN), role: 'tertiary', dash: [6, 4], legend: P.vergleich },
      seq('xo', 'x_n', folge(o, P, P.vergleich ? P.x0 : NaN, P.N), 'tertiary', { name: MODELLE[o], dash: [6, 4], legend: P.vergleich }),
      { id: 'W', label: 'W(x)', name: MODELLE[m], kind: 'continuous', x: wg.x, y: wg.y, role: 'primary' },
      { id: 'Wo', label: 'W(x)', name: MODELLE[o], kind: 'continuous', x: wgo.x, y: P.vergleich ? wgo.y : wgo.y.map(() => NaN), role: 'tertiary', dash: [6, 4], legend: P.vergleich },
      segment('eins', 'W = 1', [0, 1], [2 * w1, 1], 'reference', { name: 'Bestand bleibt gleich' }),
      points('Wpunkt', 'W(x_0)', [[P.x0, W(m, P)(P.x0)]], 'secondary', { legend: false }),
    ]
    if (P.werte) {
      const xs = [0, 1, 2, 3].map((k) => k * P.K)
      out.push(points('werteP', 'W(0), W(K), W(2K), W(3K)', xs.map((x) => [x, W(m, P)(x)]), 'data', { name: 'Werte' }))
      if (P.vergleich) out.push(points('werteO', 'W', xs.map((x) => [x, W(o, P)(x)]), 'tertiary', { legend: false }))
    }
    if (P.grenze && gezeigt(P).includes('logistisch')) {
      const xg = grenzwert(P)
      out.push(
        segment('grenzeL', String.raw`x_0 = K\,(1 + \tfrac1r) ${'\\approx'} ${num(xg, 1)}`, [xg, -1e7], [xg, 1e7], 'reference', { name: 'Grenze', dash: [3, 3] }),
        points('grenzeP', 'Grenze', [[xg, 0]], 'reference', { legend: false }),
      )
    }
    if (P.fix) {
      out.push(
        points('fixP', 'x^* = 0, K', [[0, 0], [P.K, P.K]], 'data', { name: 'Gleichgewichte' }),
        segment('Klinie', 'K', [0, P.K], [P.N, P.K], 'reference', { name: 'Gleichgewicht x* = K' }),
      )
    }
    return out
  },
  observables: ({ p, x }) => {
    const P = p as FishP
    const m = P.modell
    const xs = Array.from(x.subarray(0, Math.min(x.length, 11)))
    return {
      x1: quantity('$x_1 = f(x_0)$', F(m, P)(P.x0), { digits: 6, note: 'ausgestorben' }),
      W0: quantity('$W(x_0)$', W(m, P)(P.x0), { digits: 3 }),
      grenze: quantity('größter Anfangswert mit $x_1 > 0$', P.grenze && m === 'logistisch' ? grenzwert(P) : null, { digits: 6, note: m === 'ricker' ? 'keiner: W(x) > 0' : 'Schalter „Grenze“' }),
      folge: list('$x_0, x_1, x_2, \\dots$', xs.map((v) => (Number.isFinite(v) ? v : NaN)), { digits: 5, names: xs.map((_, k) => `x_{${k}}`) }),
      xN: quantity('$x_N$', x[x.length - 1], { digits: 5, note: 'ausgestorben' }),
      fix: list('Gleichgewichtspunkte $x^*$', P.fix ? [0, P.K] : null, { digits: 4, names: ['x_a^*', 'x_b^*'], note: 'Schalter „Gleichgewichtspunkte“' }),
      werte: list('$W(x)$ bei $0, K, 2K, 3K$', P.werte ? [0, 1, 2, 3].map((k) => W(m, P)(k * P.K)) : null, { digits: 4, names: ['W(0)', 'W(K)', 'W(2K)', 'W(3K)'], note: 'Schalter „W bei 0, K, 2K, 3K“' }),
    }
  },
})

const FISH_PARAMS = ['modell', 'vergleich', 'r', 'K', 'x0', 'grenze', 'fix', 'werte']
/** The update function (cobweb tabs) or the factor W (tabs 4.1 b, 4.2 a), for each model shown. */
const fishFormulas = (art: 'f' | 'W') => (p: any) => {
  const P = p as FishP
  const k = String.raw`\left(1 - \frac{x}{{{K}}}\right)`
  const tex = (m: Modell) =>
    art === 'W'
      ? String.raw`W(x) = ${m === 'logistisch' ? String.raw`1 + {{r}}{{*}}${k}` : String.raw`e^{{{r}}${k}}`}`
      : String.raw`f(x) = ${m === 'logistisch' ? String.raw`x + {{r}}{{*}}${k}\,x` : String.raw`x\,e^{{{r}}${k}}`}`
  return [
    ...gezeigt(P).map((m) => ({ label: P.vergleich ? MODELLE[m] : art === 'W' ? 'Vermehrungsfaktor' : 'Vorschrift', tex: tex(m) })),
    ...(art === 'W' ? [{ label: 'Vorschrift', tex: String.raw`x_{n+1} = W(x_n)\cdot x_n` }] : []),
    { label: 'Start', tex: String.raw`x_0 = {{#x0}}` },
  ]
}

/** The value just reached, on the x axis of the cobweb. */
const stepGuide =
  (y0: (p: any) => number) =>
  (p: any, { step, run }: { step: number; run: Run }): readonly Guide[] => {
    const x = run.series.find((s) => s.id === 'x')?.y
    const k = Math.min(step, (x?.length ?? 0) - 1)
    if (!x || k < 1 || !Number.isFinite(x[k])) return []
    return [{ kind: 'drop', from: [x[k], x[k]], to: [x[k], y0(p)], label: `x_{${k}}` }]
  }

const fishCobweb = {
  type: 'cobweb' as const,
  title: 'Spinnwebdiagramm',
  f: 'f',
  orbit: 'x',
  orbits: ['xo'],
  series: ['fo', 'grenzeL', 'grenzeP', 'fixP'],
  xLabel: 'x',
  yLabel: 'f(x)',
  x: (p: any): [number, number] => [0, fischX(p)],
  y: (p: any) => fischY(p),
  stretch: true,
  drag: [{ param: 'x0', axis: 'x' as const, at: (p: any): [number, number] => [p.x0, 0], set: (x: number) => ({ x0: Math.max(0, Math.round(x)) }) }],
  guides: stepGuide(() => 0),
}
const fishSeries = {
  type: 'timeSeriesDiscrete' as const,
  title: 'Bestand über die Jahre',
  series: ['x', 'xo', 'Klinie'],
  xLabel: 'n \\text{ (Jahre)}',
  yLabel: 'x_n',
  y: (p: any) => fischY(p),
  drag: { param: 'x0', axis: 'y' as const },
}
const wPlot = {
  type: 'functionGraph' as const,
  title: 'Vermehrungsfaktor pro Tier',
  series: ['W', 'Wo', 'eins', 'grenzeL', 'grenzeP', 'werteP', 'werteO', 'Wpunkt'],
  xLabel: 'x',
  yLabel: 'W(x)',
  x: (p: any) => wX(p),
  y: (p: any) => wY(p),
  drag: [{ param: 'x0', axis: 'x' as const, label: 'x_0', at: (p: any): [number, number] => [p.x0, W(p.modell, p)(p.x0)], set: (x: number) => ({ x0: Math.max(0, Math.round(x)) }) }],
}

const fishApplet = (id: string, title: string, summary: string, plots: readonly any[], shown: readonly string[], readouts: readonly string[], scenarios: Scenarios) =>
  defineApplet({
    id,
    title,
    summary,
    chapter: 'I',
    model: fischModel,
    horizon: 'N',
    formulas: fishFormulas(plots.includes(wPlot) ? 'W' : 'f'),
    plots,
    layout: only(shown, FISH_PARAMS, { grenze: (p: any) => shown.includes('grenze') && gezeigt(p).includes('logistisch') }),
    readouts,
    scenarios,
  })

const BLATT = { modell: 'logistisch', vergleich: false, r: 1.2, K: 1000, grenze: false, fix: false, werte: false }
const RICKER = { ...BLATT, modell: 'ricker' }

const ausloeschung = fishApplet(
  'blatt4-ausloeschung',
  'Logistisches Modell: sofortige Auslöschung',
  'f(x) = x + r (1 − x/K) x mit K = 1000, r = 1.2',
  [fishCobweb, fishSeries],
  ['r', 'K', 'x0', 'grenze'],
  ['x1', 'grenze'],
  [
    { label: 'x₀ = 500', text: 'Ein kleiner Bestand wächst. Den Anfangsbestand kann man im Bild ziehen.', params: { ...BLATT, x0: 500, N: 3 } },
    { label: 'x₀ = 1500', text: 'Über K: der Bestand schrumpft, bleibt aber positiv.', params: { ...BLATT, x0: 1500, N: 3 } },
    { label: 'x₀ = 1900', text: 'Zu viele Fische: schon x₁ ist negativ.', params: { ...BLATT, x0: 1900, N: 3 } },
    { label: 'Grenze', text: 'Bis zu dieser Stelle bleibt x₁ positiv.', params: { ...BLATT, x0: 1833, grenze: true, N: 3 } },
  ],
)

const faktor = fishApplet(
  'blatt4-faktor',
  'Vermehrungsfaktor pro Tier',
  'x_{n+1} = W(x_n) · x_n mit W(x) = 1 + r (1 − x/K)',
  [wPlot, fishSeries],
  ['modell', 'vergleich', 'r', 'K', 'x0', 'grenze'],
  ['W0', 'x1', 'grenze'],
  [
    { label: 'W skizzieren', text: 'Eine Gerade: W(0) = 1 + r, W(K) = 1. Den Anfangsbestand kann man im Bild ziehen.', params: { ...BLATT, x0: 500, N: 3 } },
    { label: 'x₀ = 1500', text: 'Zwischen 0 und 1 schrumpft der Bestand.', params: { ...BLATT, x0: 1500, N: 3 } },
    { label: 'W < 0', text: 'Ein negativer Faktor macht aus x₀ ein negatives x₁.', params: { ...BLATT, x0: 1900, N: 3 } },
    { label: 'Grenze', text: 'W(x) = 0 genau bei x = K(1 + 1/r).', params: { ...BLATT, x0: 1833, grenze: true, N: 3 } },
  ],
)

const gleichgewicht = fishApplet(
  'blatt4-gleichgewicht',
  'Gleichgewichtspunkte',
  'x = f(x): Schnittpunkte mit der Diagonale',
  [fishCobweb, fishSeries],
  ['modell', 'vergleich', 'r', 'K', 'x0', 'fix'],
  ['xN', 'fix'],
  [
    { label: 'x₀ = 200', text: 'Die Treppe läuft in einen Schnittpunkt mit der Diagonale. Den Anfangsbestand kann man im Bild ziehen.', params: { ...BLATT, x0: 200, N: 12 } },
    { label: 'Gleichgewichte', text: 'x* = 0 und x* = K = 1000.', params: { ...BLATT, x0: 200, fix: true, N: 12 } },
    { label: 'x₀ = K', text: 'Wer bei K startet, bleibt dort.', params: { ...BLATT, x0: 1000, fix: true, N: 12 } },
    { label: 'x₀ = 0', text: 'Ohne Fische keine Fische.', params: { ...BLATT, x0: 0, fix: true, N: 12 } },
  ],
)

const rickerFaktor = fishApplet(
  'blatt4-ricker-faktor',
  'Vermehrungsfaktor nach Ricker',
  'W(x) = e^{r (1 − x/K)} neben 1 + r (1 − x/K)',
  [wPlot, fishSeries],
  ['modell', 'vergleich', 'r', 'K', 'x0', 'werte'],
  ['werte', 'W0', 'x1'],
  [
    { label: 'W(0), W(1000), W(2000), W(3000)', text: 'Die Werte, im Bild als Punkte. Den Anfangsbestand kann man im Bild ziehen.', params: { ...RICKER, werte: true, x0: 2000, N: 3 } },
    { label: 'mit der Skizze aus 4.1', text: 'Gestrichelt das logistische W: es wird negativ, das von Ricker nie.', params: { ...RICKER, vergleich: true, werte: true, x0: 2000, N: 3 } },
  ],
)

const rickerFolge = fishApplet(
  'blatt4-ricker-folge',
  'Ricker-Modell ab x₀ = 2000',
  'x_{n+1} = x_n e^{r (1 − x_n/K)}',
  [fishSeries, fishCobweb],
  ['modell', 'vergleich', 'r', 'K', 'x0', 'fix'],
  ['folge'],
  [
    { label: 'x₁, x₂, x₃', text: 'Erst ein Einbruch, dann wächst der Bestand wieder auf K zu. Den Anfangsbestand kann man im Bild ziehen.', params: { ...RICKER, x0: 2000, N: 3 } },
    { label: 'weiter', text: 'Zwölf Jahre.', params: { ...RICKER, x0: 2000, N: 12 } },
    { label: 'logistisch zum Vergleich', text: 'Gestrichelt: im logistischen Modell wäre der Bestand ab 2000 sofort ausgelöscht.', params: { ...RICKER, vergleich: true, x0: 2000, N: 6 } },
  ],
)

const rickerGleichgewicht = fishApplet(
  'blatt4-ricker-gleichgewicht',
  'Gleichgewichtspunkte im Ricker-Modell',
  'x = x e^{r (1 − x/K)}',
  [fishCobweb, fishSeries],
  ['modell', 'vergleich', 'r', 'K', 'x0', 'fix'],
  ['fix', 'xN'],
  [
    { label: 'Gleichgewichte', text: 'x* = 0 und x* = K, wie im logistischen Modell.', params: { ...RICKER, fix: true, x0: 2000, N: 12 } },
    { label: 'beide Modelle', text: 'Gleiche Schnittpunkte mit der Diagonale, verschiedene Graphen.', params: { ...RICKER, vergleich: true, fix: true, x0: 200, N: 12 } },
    { label: 'r = 2.7', text: 'Größere Rate: der Bestand springt um K herum und kommt nicht zur Ruhe.', params: { ...RICKER, r: 2.7, fix: true, x0: 200, N: 30 } },
  ],
)

// ================================================================ 4.3 a, b: Beverton und Holt

type BhP = { x0: number; formel: boolean; grenzwert: boolean; fix: boolean; N: number }
const bh = (x: number) => (2 * x) / (1 + x)
/** The solution for any start: x_n = 2ⁿ x₀ / (1 + (2ⁿ − 1) x₀); for x₀ = ½ it is 2ⁿ/(1 + 2ⁿ). */
const bhLoesung = (x0: number) => (n: number) => (2 ** n * x0) / (1 + (2 ** n - 1) * x0)
const bhX = (p: BhP) => Math.max(2.2, 1.15 * p.x0)

const bhModel = iteration({
  id: 'blatt4-bh',
  params: {
    x0: real('Startwert', { latex: 'x_0', min: 0, max: 6, step: 0.01, default: 0.5 }),
    formel: bool('Lösungsformel', { default: false, labelOn: 'an', labelOff: 'aus' }),
    grenzwert: bool('Grenzwert', { default: false, labelOn: 'an', labelOff: 'aus' }),
    fix: bool('Fixpunkte', { default: false, labelOn: 'an', labelOff: 'aus' }),
    N: steps('Jahre', { latex: 'N', default: 6, max: 60 }),
  },
  start: (p) => p.x0,
  step: (x) => bh(x),
  horizon: (p) => p.N,
  series: { id: 'x', label: 'x_n', name: 'Fische' },
  extraSeries: ({ p, detail }) => {
    const [lo, hi] = detail?.x ?? [0, bhX(p as BhP)]
    const g = sample(bh, Math.max(0, lo - (hi - lo)), hi + (hi - lo), 801)
    const out: Series[] = [{ id: 'f', label: 'f(x)', kind: 'continuous', x: g.x, y: g.y, role: 'primary' }]
    if (p.formel) {
      const t = Float64Array.from({ length: 300 }, (_, i) => (p.N * i) / 299)
      const label = p.x0 === 0.5 ? String.raw`\frac{2^n}{1 + 2^n}` : String.raw`\frac{2^n x_0}{1 + (2^n - 1)\,x_0}`
      out.push({ id: 'formel', label, name: 'Lösungsformel', kind: 'continuous', x: t, y: t.map(bhLoesung(p.x0)), role: 'reference', dash: [5, 4] })
    }
    if (p.grenzwert) out.push(segment('eins', '\\lim x_n = 1', [0, 1], [p.N, 1], 'tertiary', { name: 'Grenzwert', dash: [3, 3] }))
    if (p.fix) out.push(points('fixP', 'x^* = 0, 1', [[0, 0], [1, 1]], 'data', { name: 'Fixpunkte' }))
    return out
  },
  observables: ({ p, x }) => {
    const xN = x[x.length - 1]
    return {
      xN: quantity('$x_N$', xN, { digits: 6 }),
      abstand: quantity('Abstand $|x_N - 1|$', Math.abs(xN - 1), { digits: 3 }),
      fix: list('Fixpunkte $x = f(x)$', p.fix ? [0, 1] : null, { digits: 3, names: ['x_a^*', 'x_b^*'], note: 'Schalter „Fixpunkte“' }),
    }
  },
})

const bevertonHolt = defineApplet({
  id: 'blatt4-bh',
  title: 'Beverton–Holt: Grenzwert und Fixpunkte',
  summary: 'x_{n+1} = 2x_n / (1 + x_n), x_n = 2ⁿ/(1 + 2ⁿ)',
  chapter: 'I',
  model: bhModel,
  horizon: 'N',
  formulas: (p) => [
    { label: 'Vorschrift', tex: String.raw`x_{n+1} = f(x_n) = \frac{2x_n}{1 + x_n}` },
    { label: 'Start', tex: String.raw`x_0 = {{#x0}}` },
    ...(p.formel ? [{ label: 'Lösungsformel', tex: p.x0 === 0.5 ? String.raw`x_n = \frac{2^n}{1 + 2^n} = \frac{1}{2^{-n} + 1}` : String.raw`x_n = \frac{2^n x_0}{1 + (2^n - 1)\,x_0}` }] : []),
  ],
  plots: [
    { type: 'timeSeriesDiscrete', title: 'Folge', series: ['x', 'formel', 'eins'], xLabel: 'n \\text{ (Jahre)}', yLabel: 'x_n \\text{ (Tausend Fische)}', y: (p: any) => [0, bhX(p)], drag: { param: 'x0', axis: 'y' } },
    {
      type: 'cobweb',
      title: 'Spinnwebdiagramm',
      f: 'f',
      orbit: 'x',
      series: ['fixP'],
      xLabel: 'x',
      yLabel: 'f(x)',
      x: (p: any) => [0, bhX(p)],
      y: (p: any) => [0, bhX(p)],
      drag: [{ param: 'x0', axis: 'x', at: (p: any) => [p.x0, 0], set: (x: number) => ({ x0: Math.max(0, x) }) }],
      guides: stepGuide(() => 0),
    },
  ],
  layout: { main: ['x0', 'formel', 'grenzwert', 'fix'] },
  readouts: ['xN', 'abstand', 'fix'],
  scenarios: [
    { label: 'a) x₀ = 1/2', text: 'Die Folge mit ihrer Lösungsformel. Den Startwert kann man im Bild ziehen.', params: { x0: 0.5, formel: true, grenzwert: false, fix: false, N: 8 } },
    { label: 'a) Grenzwert', text: '2ⁿ/(1 + 2ⁿ) = 1/(2⁻ⁿ + 1) → 1.', params: { x0: 0.5, formel: true, grenzwert: true, fix: false, N: 12 } },
    { label: 'b) Fixpunkte', text: 'Nur ein Fixpunkt x = f(x) kommt als Grenzwert infrage: 0 oder 1.', params: { x0: 0.5, formel: false, grenzwert: true, fix: true, N: 12 } },
    { label: 'b) x₀ = 3', text: 'Von oben läuft die Folge ebenfalls zu 1.', params: { x0: 3, formel: false, grenzwert: true, fix: true, N: 12 } },
    { label: 'b) x₀ = 0', text: 'Ohne Fische bleibt es bei 0.', params: { x0: 0, formel: false, grenzwert: false, fix: true, N: 12 } },
  ],
})

// ================================================================ 4.3 c: lim f(x) für x → ∞

const unendlich = defineApplet({
  id: 'blatt4-bh-unendlich',
  title: 'Beverton–Holt: sehr große Bestände',
  summary: 'f(x) = 2x/(1 + x) → 2 für x → ∞',
  chapter: 'I',
  model: closedForm({
    id: 'blatt4-bh-unendlich',
    params: { X: real('Fenster bis', { latex: 'X', min: 5, max: 100000, step: 1, default: 20, scale: 'log' }) },
    domain: (p) => [0, p.X],
    samples: 800,
    curves: { f: { label: 'f(x)', f: (x) => bh(x) } },
    extraSeries: ({ p }) => [segment('L', 'y = 2', [0, 2], [p.X, 2], 'reference', { name: 'Grenzwert', dash: [3, 3] }), points('XP', 'f(X)', [[p.X, bh(p.X)]], 'secondary', { legend: false })],
    observables: ({ p }) => ({
      fX: quantity('$f(X)$', bh(p.X), { digits: 6 }),
      abstand: quantity('$2 - f(X)$', 2 - bh(p.X), { digits: 3 }),
    }),
  }),
  formulas: [
    { label: 'Funktion', tex: String.raw`f(x) = \frac{2x}{1 + x} = \frac{2}{\frac1x + 1}` },
    { label: 'Fenster', tex: String.raw`0 \le x \le {{X}}` },
  ],
  plots: [
    {
      type: 'functionGraph',
      series: ['f', 'L', 'XP'],
      xLabel: 'x \\text{ (Tausend Fische)}',
      yLabel: 'f(x)',
      x: (p: any) => [0, p.X],
      y: [0, 2.3],
      drag: [{ param: 'X', axis: 'x', label: 'X', at: (p: any) => [p.X, bh(p.X)], set: (x: number) => ({ X: Math.max(5, x) }) }],
    },
  ],
  readouts: ['fX', 'abstand'],
  scenarios: [
    { label: 'x bis 20', text: 'Je mehr Fische, desto näher kommt f an 2. Das Ende des Fensters kann man im Bild ziehen.', params: { X: 20 } },
    { label: 'x bis 1000', params: { X: 1000 } },
    { label: 'x bis 100 000', text: 'Selbst hundert Millionen Fische bringen im nächsten Jahr weniger als 2000.', params: { X: 100000 } },
  ],
})

// ======================================== 4.3 d und 4.4: Ableitung mit der Definition

interface Fn {
  label: string
  tex: string
  f: (x: number) => number
  /** f′(x), NaN where f has no derivative. */
  df: (x: number) => number
  /** Where f is defined (and drawn). */
  domain: readonly [number, number]
  /** The window at magnification 1, relative to (a, f(a)). */
  dx: readonly [number, number]
  dy: readonly [number, number]
  a: number
}
const FNS: Record<'bh' | 'bruch' | 'betrag', Fn> = {
  bh: { label: '$\\frac{2x}{1 + x}$', tex: String.raw`\frac{2x}{1 + x}`, f: bh, df: (x) => 2 / (1 + x) ** 2, domain: [0, 20], dx: [-0.3, 4], dy: [-0.3, 2.3], a: 0 },
  bruch: { label: '$\\frac{1 - x}{2 + x}$', tex: String.raw`\frac{1 - x}{2 + x}`, f: (x) => (1 - x) / (2 + x), df: (x) => -3 / (2 + x) ** 2, domain: [-1.8, 20], dx: [-2.5, 3], dy: [-1, 2], a: 1 },
  betrag: { label: '$|x|$', tex: String.raw`|x|`, f: Math.abs, df: (x) => (x === 0 ? NaN : Math.sign(x)), domain: [-20, 20], dx: [-2, 2], dy: [-0.6, 2], a: 0 },
}
type FnId = keyof typeof FNS
type DP = { fn: FnId; a: number; h: number; tangente: boolean; zoom: number; x0: number }
const H = 1
const inDomain = (F: Fn, x: number) => x >= F.domain[0] && x <= F.domain[1]
const q = (F: Fn, a: number, h: number) => (F.f(a + h) - F.f(a)) / h
/** The one-sided limits of the difference quotient, numerically; null where a ± h leaves the domain. */
const seiten = (F: Fn, a: number) => {
  const e = 1e-7
  const r = (v: number) => +v.toFixed(6)
  return { links: inDomain(F, a - e) ? r(q(F, a, -e)) : null, rechts: inDomain(F, a + e) ? r(q(F, a, e)) : null }
}
const differenzierbar = (F: Fn, a: number) => {
  const { links, rechts } = seiten(F, a)
  if (links === null || rechts === null) return links ?? rechts
  return Math.abs(links - rechts) < 1e-4 ? (links + rechts) / 2 : null
}
const lineThrough = (x0: number, y0: number, m: number, lo: number, hi: number) => ({ x: Float64Array.of(lo, hi), y: Float64Array.of(y0 + m * (lo - x0), y0 + m * (hi - x0)) })
const winX = (p: DP): [number, number] => {
  const F = FNS[p.fn]
  return [p.a + F.dx[0] / p.zoom, p.a + F.dx[1] / p.zoom]
}
const winY = (p: DP): [number, number] => {
  const F = FNS[p.fn]
  return [F.f(p.a) + F.dy[0] / p.zoom, F.f(p.a) + F.dy[1] / p.zoom]
}

const ableitungModel = closedForm({
  id: 'blatt4-ableitung',
  params: {
    fn: choice('Funktion', (Object.keys(FNS) as FnId[]).map((value) => ({ value, label: FNS[value].label })), 'bh'),
    a: real('Stelle', { latex: 'a', min: -1.5, max: 5, step: 0.01, default: 0 }),
    h: real('Schrittweite', { latex: 'h', min: -H, max: H, step: 0.001, default: 0.5 }),
    tangente: bool('Tangente', { default: false, labelOn: 'an', labelOff: 'aus' }),
    zoom: real('Vergrößerung', { latex: 'z', min: 1, max: 1000, step: 0.1, default: 1, scale: 'log' }),
    x0: real('kleiner Anfangsbestand', { latex: 'x_0', min: 0.001, max: 0.5, step: 0.001, default: 0.01, scale: 'log' }),
  },
  normalize: (p) => {
    const F = FNS[p.fn as FnId]
    const a = Math.min(F.domain[1], Math.max(F.domain[0], p.a))
    let h = Math.max(-H, Math.min(H, p.h))
    if (!inDomain(F, a + h)) h = (inDomain(F, a - h) ? -h : 0.5)
    return a === p.a && h === p.h ? p : { ...p, a, h }
  },
  constraintNote: 'a und a + h liegen im Definitionsbereich von f',
  domain: (p) => [Math.max(FNS[p.fn as FnId].domain[0], winX(p as DP)[0]), Math.min(FNS[p.fn as FnId].domain[1], winX(p as DP)[1])],
  samples: 800,
  curves: { f: { label: 'f(x)', f: (x, p) => (inDomain(FNS[p.fn as FnId], x) ? FNS[p.fn as FnId].f(x) : NaN) } },
  extraSeries: ({ p }) => {
    const P = p as DP
    const F = FNS[P.fn]
    const fa = F.f(P.a)
    const [lo, hi] = winX(P)
    const w = hi - lo
    const out: Series[] = []
    if (P.h !== 0) out.push({ id: 'sekante', label: 's(x)', name: 'Sekante', kind: 'continuous', ...lineThrough(P.a, fa, q(F, P.a, P.h), lo - w, hi + w), role: 'secondary' })
    const d = differenzierbar(F, P.a)
    if (P.tangente && d !== null) out.push({ id: 'tangente', label: 't(x)', name: 'Tangente', kind: 'continuous', ...lineThrough(P.a, fa, d, lo - w, hi + w), role: 'tertiary' })
    out.push(points('aPunkt', 'a', [[P.a, fa]], 'data', { legend: false }))
    if (P.h !== 0) out.push(points('hPunkt', 'a + h', [[P.a + P.h, F.f(P.a + P.h)]], 'secondary', { legend: false }))
    // the difference quotient over h: a curve with a hole at h = 0 (or a jump, for |x| at 0)
    const g = sample((h) => (Math.abs(h) < 1e-9 || !inDomain(F, P.a + h) ? NaN : q(F, P.a, h)), -H, H, 801)
    const { links, rechts } = seiten(F, P.a)
    const loecher: [number, number][] = []
    if (links !== null) loecher.push([0, links])
    if (rechts !== null && (links === null || Math.abs(rechts - links) > 1e-4)) loecher.push([0, rechts])
    out.push(
      { id: 'g', label: 'g(h)', kind: 'continuous', x: g.x, y: g.y, role: 'primary' },
      points('loch', 'g', loecher, 'primary', { legend: false, hollow: true }),
      ...(P.h !== 0 ? [points('gPunkt', 'g(h)', [[P.h, q(F, P.a, P.h)]], 'secondary', { legend: false })] : []),
    )
    if (d !== null) out.push(segment('grenze', "f'(a)", [-H, d], [H, d], 'reference', { name: 'Grenzwert', dash: [3, 3] }))
    // 4.3 d: a small stock, once with f and once with the tangent t(x) = 2x
    const N = 12
    const it = (m: (x: number) => number) => {
      const y = new Float64Array(N + 1)
      y[0] = P.x0
      for (let k = 0; k < N; k++) y[k + 1] = m(y[k])
      return y
    }
    out.push(seq('klein', 'x_{n+1} = f(x_n)', it(bh), 'primary', { name: 'Beverton–Holt' }), seq('kleinT', 'x_{n+1} = 2x_n', it((x) => 2 * x), 'tertiary', { name: 'Tangente: Verdopplung', dash: [5, 4] }))
    return out
  },
  observables: ({ p }) => {
    const P = p as DP
    const F = FNS[P.fn]
    const { links, rechts } = seiten(F, P.a)
    const d = differenzierbar(F, P.a)
    return {
      quotient: quantity('Differenzenquotient $g(h)$', P.h === 0 ? null : q(F, P.a, P.h), { digits: 5, note: 'bei h = 0 nicht definiert' }),
      links: quantity('Grenzwert für $h \\to 0$ von links', links, { digits: 4, note: 'a − h liegt nicht im Definitionsbereich' }),
      rechts: quantity('Grenzwert für $h \\to 0$ von rechts', rechts, { digits: 4 }),
      ergebnis: category('differenzierbar in $a$?', d !== null ? `ja, f'(a) = ${num(d)}` : 'nein'),
    }
  },
})

const graph = {
  type: 'functionGraph' as const,
  title: 'Sekante und Tangente',
  series: ['f', 'sekante', 'tangente', 'aPunkt', 'hPunkt'],
  xLabel: 'x',
  yLabel: 'f(x)',
  x: (p: any) => winX(p),
  y: (p: any) => winY(p),
  drag: [
    { param: 'a', axis: 'x' as const, at: (p: any): [number, number] => [p.a, FNS[p.fn as FnId].f(p.a)], set: (x: number) => ({ a: x }) },
    { param: 'h', axis: 'x' as const, label: 'a + h', at: (p: any): [number, number] | null => (p.h === 0 ? null : [p.a + p.h, FNS[p.fn as FnId].f(p.a + p.h)]), set: (x: number, _y: number, p: any) => ({ h: Math.max(-H, Math.min(H, x - p.a)) }) },
  ],
  // the slope triangle of the secant: run h, rise f(a + h) − f(a)
  guides: (p: any): readonly Guide[] => {
    const F = FNS[p.fn as FnId]
    if (p.h === 0) return []
    const A: [number, number] = [p.a, F.f(p.a)]
    const B: [number, number] = [p.a + p.h, F.f(p.a + p.h)]
    return [{ kind: 'rise', from: A, to: B, label: num(B[1] - A[1], 3), run: `h = ${num(p.h, 3)}` }]
  },
}
const quotientPlot = {
  type: 'functionGraph' as const,
  title: 'Differenzenquotient',
  series: ['g', 'grenze', 'loch', 'gPunkt'],
  xLabel: 'h',
  yLabel: 'g(h)',
  x: [-H, H] as [number, number],
  y: (p: any): [number, number] => {
    const F = FNS[p.fn as FnId]
    let [lo, hi] = [Infinity, -Infinity]
    for (let h = -H; h <= H; h += 0.005) {
      const v = Math.abs(h) < 1e-9 || !inDomain(F, p.a + h) ? NaN : q(F, p.a, h)
      if (Number.isFinite(v)) [lo, hi] = [Math.min(lo, v), Math.max(hi, v)]
    }
    if (!Number.isFinite(lo)) return [-1, 1]
    const pad = 0.15 * (hi - lo || 1)
    return [Math.min(lo - pad, hi > 0 && lo > 0 ? 0 : lo - pad), Math.max(hi + pad, hi < 0 && lo < 0 ? 0 : hi + pad)]
  },
  drag: [{ param: 'h', axis: 'x' as const, at: (p: any): [number, number] | null => (p.h === 0 ? null : [p.h, q(FNS[p.fn as FnId], p.a, p.h)]), set: (x: number) => ({ h: x }) }],
}
const kleinPlot = {
  type: 'timeSeriesDiscrete' as const,
  title: 'Eine sehr kleine Population',
  series: ['klein', 'kleinT'],
  xLabel: 'n \\text{ (Jahre)}',
  yLabel: 'x_n \\text{ (Tausend Fische)}',
  y: [0, 2.2] as [number, number],
  drag: { param: 'x0', axis: 'y' as const },
}

const ableitungFormulas = (p: any) => {
  const P = p as DP
  const F = FNS[P.fn]
  const d = differenzierbar(F, P.a)
  return [
    { label: 'Funktion', tex: String.raw`f(x) = ${F.tex}` },
    { label: 'Differenzenquotient', tex: String.raw`g(h) = \frac{f({{a}} + {{h}}) - f({{a}})}{{{h}}}` },
    ...(P.tangente && d !== null ? [{ label: 'Tangente', tex: String.raw`t(x) = f(a) + f'(a)\,(x - a) = ${num(F.f(P.a))} ${d < 0 ? '-' : '+'} ${num(Math.abs(d))}\,(x - ${num(P.a)})` }] : []),
  ]
}

const BH0 = { fn: 'bh' as const, a: 0, zoom: 1, x0: 0.01 }
const ableitung43 = defineApplet({
  id: 'blatt4-bh-ableitung',
  title: "Beverton–Holt: f'(0) mit der Definition",
  summary: 'g(h) = (f(h) − f(0))/h = 2/(1 + h) → 2',
  chapter: 'I',
  model: ableitungModel,
  formulas: ableitungFormulas,
  plots: [graph, quotientPlot],
  layout: only(['a', 'h', 'tangente', 'zoom'], ['fn', 'a', 'h', 'tangente', 'zoom', 'x0']),
  readouts: ['quotient', 'rechts', 'ergebnis'],
  scenarios: [
    { label: 'h = 0.5', text: 'Die Sekante durch (0, 0) und (h, f(h)). Die Punkte kann man im Bild ziehen.', params: { ...BH0, h: 0.5, tangente: false } },
    { label: 'h = 0.01', text: 'g(h) = 2/(1 + h) kommt 2 beliebig nahe.', params: { ...BH0, h: 0.01, tangente: false } },
    { label: 'Tangente', text: "f'(0) = 2, also t(x) = 2x.", params: { ...BH0, h: 0.2, tangente: true } },
  ],
})

const tangente43 = defineApplet({
  id: 'blatt4-bh-tangente',
  title: 'Beverton–Holt: die Tangente und eine kleine Population',
  summary: 't(x) = 2x: kleine Bestände verdoppeln sich etwa',
  chapter: 'I',
  model: ableitungModel,
  formulas: ableitungFormulas,
  plots: [{ ...graph, title: 'Graph und Tangente' }, kleinPlot],
  layout: only(['zoom', 'x0'], ['fn', 'a', 'h', 'tangente', 'zoom', 'x0']),
  readouts: ['ergebnis'],
  scenarios: [
    { label: 'Tangente', text: 't(x) = 2x: eine sehr kleine Population verdoppelt sich etwa jedes Jahr. Den Anfangsbestand kann man im Bild ziehen.', params: { ...BH0, h: 0, tangente: true } },
    { label: 'Lupe', text: 'Nahe bei 0 sind f und t kaum zu unterscheiden.', params: { ...BH0, h: 0, tangente: true, zoom: 20 } },
    { label: 'x₀ = 0.001', text: 'Je kleiner der Anfang, desto länger stimmt die Verdopplung.', params: { ...BH0, h: 0, tangente: true, x0: 0.001 } },
  ],
})

const ableitung44 = defineApplet({
  id: 'blatt4-differenzierbar',
  title: 'Differenzierbar oder nicht?',
  summary: 'der Differenzenquotient von links und von rechts',
  chapter: 'I',
  model: ableitungModel,
  formulas: ableitungFormulas,
  plots: [graph, quotientPlot],
  layout: only(['fn', 'a', 'h', 'tangente', 'zoom'], ['fn', 'a', 'h', 'tangente', 'zoom', 'x0']),
  readouts: ['quotient', 'links', 'rechts', 'ergebnis'],
  scenarios: [
    { label: 'a) h = 0.5', text: 'f(x) = (1 − x)/(2 + x) bei a = 1. Die Punkte kann man im Bild ziehen.', params: { fn: 'bruch', a: 1, h: 0.5, tangente: false, zoom: 1 } },
    { label: 'a) h = −0.5', text: 'Von links: derselbe Grenzwert −1/3.', params: { fn: 'bruch', a: 1, h: -0.5, tangente: false, zoom: 1 } },
    { label: 'a) Tangente', text: "g(h) = −1/(3 + h) → −1/3 = f'(1).", params: { fn: 'bruch', a: 1, h: 0.1, tangente: true, zoom: 1 } },
    { label: 'b) h > 0', text: 'f(x) = |x| bei a = 0: von rechts ist g(h) = 1.', params: { fn: 'betrag', a: 0, h: 0.5, tangente: true, zoom: 1 } },
    { label: 'b) h < 0', text: 'Von links ist g(h) = −1: kein gemeinsamer Grenzwert.', params: { fn: 'betrag', a: 0, h: -0.5, tangente: true, zoom: 1 } },
    { label: 'b) Lupe', text: 'Der Knick bleibt, so stark man auch vergrößert.', params: { fn: 'betrag', a: 0, h: 0.005, tangente: true, zoom: 100 } },
    { label: 'b) a = 1', text: 'Abseits von 0 ist |x| differenzierbar.', params: { fn: 'betrag', a: 1, h: 0.3, tangente: true, zoom: 1 } },
  ],
})

export const blatt4: AppletModule<any>[] = [ausloeschung, faktor, gleichgewicht, rickerFaktor, rickerFolge, rickerGleichgewicht, bevertonHolt, unendlich, ableitung43, tangente43, ableitung44]
