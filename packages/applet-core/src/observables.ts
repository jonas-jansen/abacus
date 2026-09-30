/**
 * Observables (§4.5): what turns an applet into a problem with an answer.
 *
 * Constructors (`zahl`, `index`, `klasse`, `liste`) build the records a model returns;
 * the detectors below compute the values. Detectors return `null` for "not detected",
 * which is meaningful and must never be conflated with 0.
 */

import type { Observable, ObservableValue } from './model'
import { derivative, roots } from './numeric'

type Extra = Pick<Observable, 'format' | 'tol' | 'note' | 'digits' | 'marks'>

export const zahl = (label: string, value: number | null, extra: Extra = {}): Observable => ({
  kind: 'zahl',
  label,
  value: value !== null && Number.isFinite(value) ? value : null,
  ...extra,
})

export const index = (label: string, value: number | null, extra: Extra = {}): Observable => ({
  kind: 'index',
  label,
  value,
  ...extra,
})

export const klasse = (label: string, value: string | null, extra: Extra = {}): Observable => ({
  kind: 'klasse',
  label,
  value,
  ...extra,
})

export const liste = (label: string, value: readonly number[] | string | null, extra: Extra = {}): Observable => ({
  kind: 'liste',
  label,
  value: value as ObservableValue,
  ...extra,
})

// ---------------------------------------------------------------------------------------
// Scalar iterations

/** Iterates `map` from x0: `transient` steps are discarded, the next `count` are returned. */
export function iterateTail(map: (x: number) => number, x0: number, transient: number, count: number): Float64Array {
  let x = x0
  for (let i = 0; i < transient && Number.isFinite(x); i++) x = map(x)
  const out = new Float64Array(count)
  for (let i = 0; i < count; i++) {
    x = map(x)
    out[i] = x
  }
  return out
}

export interface PeriodOptions {
  maxPeriod?: number
  /** Relative tolerance for "the same value again". */
  tol?: number
}

/** Smallest p with tail[i] ≈ tail[i−p] throughout, or null (chaos, divergence, or p > max). */
export function detectPeriod(tail: ArrayLike<number>, { maxPeriod = 16, tol = 1e-6 }: PeriodOptions = {}): number | null {
  const m = tail.length
  for (let i = 0; i < m; i++) if (!Number.isFinite(tail[i])) return null
  for (let p = 1; p <= maxPeriod && 2 * p <= m; p++) {
    let ok = true
    for (let i = p; i < m && ok; i++) ok = Math.abs(tail[i] - tail[i - p]) <= tol * (1 + Math.abs(tail[i]))
    if (ok) return p
  }
  return null
}

/**
 * Last value if the tail has settled within `tol`, else null. A limit that is zero up to
 * round-off relative to the sequence's size is reported as 0, not as 7,6·10⁻¹⁹⁴.
 */
export function limitOf(xs: ArrayLike<number>, { tol = 1e-6, window = 5 } = {}): number | null {
  const m = xs.length
  if (m < window + 1) return null
  const last = xs[m - 1]
  if (!Number.isFinite(last)) return null
  for (let i = m - window - 1; i < m - 1; i++) if (Math.abs(xs[i] - last) > tol * (1 + Math.abs(last))) return null
  let size = 0
  for (let i = 0; i < m; i++) if (Number.isFinite(xs[i])) size = Math.max(size, Math.abs(xs[i]))
  return Math.abs(last) <= 1e-12 * size ? 0 : last
}

export type Verhalten = 'monoton' | 'oszillierend' | 'divergent'

/**
 * Sign pattern of the tail differences. Returns null when there is no simple pattern
 * (e.g. chaotic tails) — the caller should explain that in the observable's note.
 */
export function behaviour(xs: ArrayLike<number>, { divergeAt = 1e8, window = 20 } = {}): Verhalten | null {
  const m = xs.length
  for (let i = 0; i < m; i++) if (!Number.isFinite(xs[i]) || Math.abs(xs[i]) > divergeAt) return 'divergent'
  if (m < 2) return null
  // The last `window` differences that are not round-off: a sequence that has settled
  // numerically is judged by how it approached, not by its constant tail.
  const scale = 1e-12 * (1 + Math.abs(xs[m - 1]))
  const signs: number[] = []
  for (let i = m - 1; i >= 1 && signs.length < window; i--) {
    const d = xs[i] - xs[i - 1]
    if (Math.abs(d) > scale) signs.push(Math.sign(d))
  }
  if (signs.every((s) => s === signs[0])) return 'monoton'
  if (signs.every((s, i) => i === 0 || s !== signs[i - 1])) return 'oszillierend'
  return null
}

/**
 * Whether a sequence settles down: it has come to rest numerically, or its last steps shrink
 * steadily (by a factor clearly below 1). A lasting cycle, whose steps stay the same, does not.
 */
export function settles(xs: ArrayLike<number>, window = 10): boolean {
  const m = xs.length
  if (m < 3) return false
  const last = xs[m - 1]
  if (!Number.isFinite(last)) return false
  const scale = 1e-9 * (1 + Math.abs(last))
  const d = (i: number) => Math.abs(xs[i] - xs[i - 1])
  if (d(m - 1) <= scale) return true
  const from = Math.max(1, m - window)
  for (let i = from + 1; i < m; i++) if (!(d(i) < d(i - 1))) return false
  return d(m - 1) / d(m - 2) < 0.999
}

const VERHALTEN_TEXT: Record<Verhalten, string> = { monoton: 'monoton', oszillierend: 'oszillierend', divergent: 'divergent' }

/**
 * The "Verhalten" readout of a sequence. Its value is the class of `behaviour` (what quizzes
 * check); what it shows adds "konvergent" when the sequence settles.
 */
export function verhalten(label: string, xs: ArrayLike<number>, extra: Extra = {}): Observable {
  const v = behaviour(xs)
  const konvergent = v !== null && v !== 'divergent' && settles(xs)
  return klasse(label, v, {
    ...(v === null ? { note: 'kein einfaches Muster' } : {}),
    format: (value) => (typeof value === 'string' && value in VERHALTEN_TEXT ? VERHALTEN_TEXT[value as Verhalten] + (konvergent ? ' konvergent' : '') : String(value ?? '—')),
    ...extra,
  })
}

/**
 * The period of an oscillation sampled at times t: the mean time between upward crossings of
 * the middle level, over the last part of the run (after the start has died away). Null when
 * it does not oscillate, or when the intervals differ by more than `tol` (relative) — then it
 * is not (yet) periodic. Also returns the crossing times, e.g. to mark the beats.
 */
export function periodOf(t: ArrayLike<number>, y: ArrayLike<number>, { from = 0.3, tol = 0.03 } = {}): { period: number; crossings: number[] } | null {
  const n = Math.min(t.length, y.length)
  const start = Math.floor(n * from)
  if (n - start < 8) return null
  let lo = Infinity
  let hi = -Infinity
  for (let i = start; i < n; i++) {
    if (y[i] < lo) lo = y[i]
    if (y[i] > hi) hi = y[i]
  }
  if (!(hi - lo > 1e-9 * (1 + Math.abs(hi)))) return null
  const mid = (lo + hi) / 2
  const crossings: number[] = []
  for (let i = start + 1; i < n; i++) {
    if (y[i - 1] < mid && y[i] >= mid) crossings.push(t[i - 1] + ((mid - y[i - 1]) / (y[i] - y[i - 1])) * (t[i] - t[i - 1]))
  }
  if (crossings.length < 3) return null
  const gaps = crossings.slice(1).map((c, i) => c - crossings[i])
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length
  if (gaps.some((g) => Math.abs(g - mean) > tol * mean)) return null
  return { period: mean, crossings }
}

export interface FixedPoint {
  x: number
  /** f'(x*) — the fixed point is attracting iff |slope| < 1. */
  slope: number
}

/**
 * Roots of f(x) − x on [a, b] with f' at each. Tangential fixed points are not found.
 * Bisection and difference-quotient noise is snapped: a fixed point at 0 is reported as 0,
 * not −4·10⁻¹³, and a slope of 0 as 0.
 */
export function fixedPoints(f: (x: number) => number, a: number, b: number, samples = 2000): FixedPoint[] {
  const scale = Math.abs(b - a)
  return roots((x) => f(x) - x, a, b, samples).map((r) => {
    const x = Math.abs(r) < 1e-9 * scale ? 0 : r
    const slope = derivative(f, x)
    return { x, slope: Math.abs(slope) < 1e-8 ? 0 : slope }
  })
}

export function maximum(xs: ArrayLike<number>): { value: number; index: number } | null {
  let best = -Infinity
  let at = -1
  for (let i = 0; i < xs.length; i++) {
    if (Number.isFinite(xs[i]) && xs[i] > best) {
      best = xs[i]
      at = i
    }
  }
  return at < 0 ? null : { value: best, index: at }
}

export function firstIndexWhere(xs: ArrayLike<number>, pred: (x: number, n: number) => boolean): number | null {
  for (let i = 0; i < xs.length; i++) if (pred(xs[i], i)) return i
  return null
}

/** Root mean square of model − data: how well a curve fits measurements. */
export function rmsFehler(model: (t: number) => number, t: ArrayLike<number>, data: ArrayLike<number>): number | null {
  let s = 0
  let n = 0
  for (let i = 0; i < t.length; i++) {
    const d = model(t[i]) - data[i]
    if (!Number.isFinite(d)) return null
    s += d * d
    n++
  }
  return n ? Math.sqrt(s / n) : null
}
