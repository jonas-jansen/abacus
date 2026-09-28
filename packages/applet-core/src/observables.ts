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
