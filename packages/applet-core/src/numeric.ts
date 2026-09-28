/** Small numerical utilities shared by observables, events and sweeps. */

export function linspace(a: number, b: number, n: number): Float64Array {
  const out = new Float64Array(n)
  if (n === 1) {
    out[0] = a
    return out
  }
  for (let i = 0; i < n; i++) out[i] = a + ((b - a) * i) / (n - 1)
  return out
}

export function indices(n: number): Float64Array {
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) out[i] = i
  return out
}

export function sample(f: (x: number) => number, a: number, b: number, n: number): { x: Float64Array; y: Float64Array } {
  const x = linspace(a, b, n)
  const y = new Float64Array(n)
  for (let i = 0; i < n; i++) y[i] = f(x[i])
  return { x, y }
}

/** Bisection on a bracketing interval. Assumes g(a)·g(b) ≤ 0. */
export function bisect(g: (x: number) => number, a: number, b: number, tol = 1e-12, maxIter = 200): number {
  let ga = g(a)
  if (ga === 0) return a
  for (let i = 0; i < maxIter && Math.abs(b - a) > tol * (1 + Math.abs(a)); i++) {
    const m = 0.5 * (a + b)
    const gm = g(m)
    if (gm === 0) return m
    if (Math.sign(gm) === Math.sign(ga)) {
      a = m
      ga = gm
    } else b = m
  }
  return 0.5 * (a + b)
}

/**
 * All sign changes of g on [a, b], located to high precision. Roots of even multiplicity
 * (tangencies) are not found — callers that care must say so in the observable's `note`.
 */
export function roots(g: (x: number) => number, a: number, b: number, samples = 2000): number[] {
  const out: number[] = []
  let x0 = a
  let g0 = g(x0)
  if (g0 === 0) out.push(x0)
  for (let i = 1; i <= samples; i++) {
    const x1 = a + ((b - a) * i) / samples
    const g1 = g(x1)
    if (g1 === 0) out.push(x1)
    else if (g0 !== 0 && Number.isFinite(g0) && Number.isFinite(g1) && Math.sign(g0) !== Math.sign(g1)) {
      out.push(bisect(g, x0, x1))
    }
    x0 = x1
    g0 = g1
  }
  return out
}

/** Central difference. */
export function derivative(f: (x: number) => number, x: number, h = 1e-6 * (1 + Math.abs(x))): number {
  return (f(x + h) - f(x - h)) / (2 * h)
}

/** Min and max over finite values, or null if there are none. */
export function extent(...arrays: ArrayLike<number>[]): [number, number] | null {
  let lo = Infinity
  let hi = -Infinity
  for (const arr of arrays) {
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i]
      if (!Number.isFinite(v)) continue
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
  }
  return lo <= hi ? [lo, hi] : null
}
