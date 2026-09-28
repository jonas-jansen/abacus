/**
 * Dormand–Prince 5(4) with adaptive step size and 4th-order dense output (Hairer, Nørsett &
 * Wanner, "DOPRI5"). Dense output is required both for smooth plotting at any zoom and for
 * event root-finding (§4.7).
 */

import { bisect } from '../numeric'

export type Rhs = (t: number, y: Float64Array) => ArrayLike<number>

export interface SolverOptions {
  rtol?: number
  atol?: number
  /** Initial step; estimated if omitted. */
  h0?: number
  hmax?: number
  maxSteps?: number
}

export interface DenseSolution {
  readonly solver: string
  readonly dim: number
  readonly t0: number
  readonly t1: number
  /** Accepted step boundaries, length steps + 1. */
  readonly ts: Float64Array
  readonly steps: number
  readonly rejected: number
  readonly warnings: string[]
  /** State at time t (clamped to [t0, t1]). */
  at(t: number, out?: Float64Array): Float64Array
  /** Component i at `count` equally spaced times over [t0, t1]. */
  sample(count: number): { t: Float64Array; y: Float64Array[] }
}

// Butcher tableau
const C2 = 1 / 5, C3 = 3 / 10, C4 = 4 / 5, C5 = 8 / 9
const A21 = 1 / 5
const A31 = 3 / 40, A32 = 9 / 40
const A41 = 44 / 45, A42 = -56 / 15, A43 = 32 / 9
const A51 = 19372 / 6561, A52 = -25360 / 2187, A53 = 64448 / 6561, A54 = -212 / 729
const A61 = 9017 / 3168, A62 = -355 / 33, A63 = 46732 / 5247, A64 = 49 / 176, A65 = -5103 / 18656
const A71 = 35 / 384, A73 = 500 / 1113, A74 = 125 / 192, A75 = -2187 / 6784, A76 = 11 / 84
// Error estimate: 5th minus embedded 4th order weights
const E1 = 71 / 57600, E3 = -71 / 16695, E4 = 71 / 1920, E5 = -17253 / 339200, E6 = 22 / 525, E7 = -1 / 40
// Dense output
const D1 = -12715105075 / 11282082432, D3 = 87487479700 / 32700410799, D4 = -10690763975 / 1880347072
const D5 = 701980252875 / 199316789632, D6 = -1453857185 / 822651844, D7 = 69997945 / 29380423

export function rk45(f: Rhs, t0: number, y0: ArrayLike<number>, t1: number, opts: SolverOptions = {}): DenseSolution {
  const n = y0.length
  const rtol = opts.rtol ?? 1e-6
  const atol = opts.atol ?? 1e-9
  const span = t1 - t0
  const hmax = opts.hmax ?? Math.abs(span)
  const maxSteps = opts.maxSteps ?? 100_000
  const warnings: string[] = []

  const call = (t: number, y: Float64Array, out: Float64Array) => {
    const r = f(t, y)
    for (let i = 0; i < n; i++) out[i] = r[i]
  }

  let t = t0
  let y = Float64Array.from(y0)
  const k1 = new Float64Array(n), k2 = new Float64Array(n), k3 = new Float64Array(n), k4 = new Float64Array(n)
  const k5 = new Float64Array(n), k6 = new Float64Array(n), k7 = new Float64Array(n)
  const tmp = new Float64Array(n)
  let y1 = new Float64Array(n)
  call(t, y, k1)

  // Step boundaries and 5 dense-output coefficient vectors per accepted step.
  const tsList: number[] = [t0]
  const cont: number[] = []

  const norm = (v: Float64Array, ya: Float64Array, yb: Float64Array) => {
    let s = 0
    for (let i = 0; i < n; i++) {
      const sk = atol + rtol * Math.max(Math.abs(ya[i]), Math.abs(yb[i]))
      s += (v[i] / sk) ** 2
    }
    return Math.sqrt(s / n)
  }

  let h = opts.h0 ?? initialStep()
  let steps = 0
  let rejected = 0
  let lastRejected = false

  function initialStep() {
    const d0 = norm(y, y, y)
    const d1 = norm(k1, y, y)
    const h = d0 < 1e-5 || d1 < 1e-5 ? 1e-6 : (0.01 * d0) / d1
    return Math.min(h, hmax, Math.abs(span)) || 1e-6
  }

  if (span <= 0) warnings.push('Leeres Zeitintervall.')

  while (span > 0 && t < t1) {
    if (steps >= maxSteps) {
      warnings.push(`Abbruch nach ${maxSteps} Schritten bei t = ${t.toPrecision(4)}.`)
      break
    }
    if (t + h > t1) h = t1 - t
    for (let i = 0; i < n; i++) tmp[i] = y[i] + h * A21 * k1[i]
    call(t + C2 * h, tmp, k2)
    for (let i = 0; i < n; i++) tmp[i] = y[i] + h * (A31 * k1[i] + A32 * k2[i])
    call(t + C3 * h, tmp, k3)
    for (let i = 0; i < n; i++) tmp[i] = y[i] + h * (A41 * k1[i] + A42 * k2[i] + A43 * k3[i])
    call(t + C4 * h, tmp, k4)
    for (let i = 0; i < n; i++) tmp[i] = y[i] + h * (A51 * k1[i] + A52 * k2[i] + A53 * k3[i] + A54 * k4[i])
    call(t + C5 * h, tmp, k5)
    for (let i = 0; i < n; i++)
      tmp[i] = y[i] + h * (A61 * k1[i] + A62 * k2[i] + A63 * k3[i] + A64 * k4[i] + A65 * k5[i])
    call(t + h, tmp, k6)
    for (let i = 0; i < n; i++)
      y1[i] = y[i] + h * (A71 * k1[i] + A73 * k3[i] + A74 * k4[i] + A75 * k5[i] + A76 * k6[i])
    call(t + h, y1, k7)
    for (let i = 0; i < n; i++)
      tmp[i] = h * (E1 * k1[i] + E3 * k3[i] + E4 * k4[i] + E5 * k5[i] + E6 * k6[i] + E7 * k7[i])
    const err = norm(tmp, y, y1)

    if (!Number.isFinite(err)) {
      h *= 0.2
      rejected++
      lastRejected = true
      if (Math.abs(h) < 1e-14 * Math.max(1, Math.abs(t))) {
        warnings.push(`Schrittweite zu klein bei t = ${t.toPrecision(4)} (Lösung explodiert?).`)
        break
      }
      continue
    }

    if (err <= 1) {
      for (let i = 0; i < n; i++) {
        const ydiff = y1[i] - y[i]
        const bspl = h * k1[i] - ydiff
        cont.push(
          y[i],
          ydiff,
          bspl,
          ydiff - h * k7[i] - bspl,
          h * (D1 * k1[i] + D3 * k3[i] + D4 * k4[i] + D5 * k5[i] + D6 * k6[i] + D7 * k7[i]),
        )
      }
      t = t + h
      tsList.push(t)
      steps++
      const swap = y
      y = y1
      y1 = swap
      k1.set(k7) // FSAL
      const fac = Math.min(lastRejected ? 1 : 5, Math.max(0.2, 0.9 * err ** -0.2))
      h = Math.min(hmax, h * fac)
      lastRejected = false
    } else {
      h *= Math.max(0.2, 0.9 * err ** -0.2)
      rejected++
      lastRejected = true
    }
  }

  const ts = Float64Array.from(tsList)
  const coeffs = Float64Array.from(cont)
  const tEnd = ts[ts.length - 1]

  const at = (tq: number, out = new Float64Array(n)) => {
    if (steps === 0) {
      out.set(Float64Array.from(y0))
      return out
    }
    const tc = Math.min(Math.max(tq, t0), tEnd)
    // binary search: ts[k] <= tc <= ts[k+1]
    let lo = 0
    let hi = steps - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (ts[mid] <= tc) lo = mid
      else hi = mid - 1
    }
    const k = lo
    const hk = ts[k + 1] - ts[k]
    const th = hk > 0 ? (tc - ts[k]) / hk : 0
    const th1 = 1 - th
    const base = k * n * 5
    for (let i = 0; i < n; i++) {
      const o = base + i * 5
      out[i] = coeffs[o] + th * (coeffs[o + 1] + th1 * (coeffs[o + 2] + th * (coeffs[o + 3] + th1 * coeffs[o + 4])))
    }
    return out
  }

  return {
    solver: 'rk45',
    dim: n,
    t0,
    t1: tEnd,
    ts,
    steps,
    rejected,
    warnings,
    at,
    sample(count) {
      const tArr = new Float64Array(count)
      const yArr = Array.from({ length: n }, () => new Float64Array(count))
      const buf = new Float64Array(n)
      for (let j = 0; j < count; j++) {
        const tj = count === 1 ? t0 : t0 + ((tEnd - t0) * j) / (count - 1)
        tArr[j] = tj
        at(tj, buf)
        for (let i = 0; i < n; i++) yArr[i][j] = buf[i]
      }
      return { t: tArr, y: yArr }
    },
  }
}

/**
 * Event location on dense output: all t where g(t, y(t)) changes sign. Each accepted step
 * is subdivided a few times before bisecting, so events are located to solver accuracy
 * rather than to one sample spacing.
 */
export function events(sol: DenseSolution, g: (t: number, y: Float64Array) => number, subdivisions = 4): number[] {
  const out: number[] = []
  const buf = new Float64Array(sol.dim)
  const G = (t: number) => g(t, sol.at(t, buf))
  let tPrev = sol.t0
  let gPrev = G(tPrev)
  if (gPrev === 0) out.push(tPrev)
  for (let k = 0; k < sol.steps; k++) {
    const a = sol.ts[k]
    const b = sol.ts[k + 1]
    for (let j = 1; j <= subdivisions; j++) {
      const t = a + ((b - a) * j) / subdivisions
      const gt = G(t)
      if (gt === 0) out.push(t)
      else if (gPrev !== 0 && Math.sign(gt) !== Math.sign(gPrev)) out.push(bisect(G, tPrev, t))
      tPrev = t
      gPrev = gt
    }
  }
  return out
}
