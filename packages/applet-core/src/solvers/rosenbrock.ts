/**
 * Linearly implicit Rosenbrock method ROS2 (Verwer, Spee, Blom & Hundsdorfer 1999) for stiff
 * problems (§4.7): two stages, order 2, L-stable, numerical Jacobian, with the linearly
 * implicit Euler step as embedded order-1 solution for step size control. Dense output is
 * cubic Hermite interpolation, which has the method's order, so plotting and `events` work
 * exactly as with rk45.
 *
 * Why not rk45 everywhere: on a stiff problem an explicit method's step size is limited by
 * stability, not accuracy — for Michaelis–Menten with a fast binding step that means
 * hundreds of thousands of tiny steps for a curve that is smooth to the eye.
 */

import type { DenseSolution, Rhs, SolverOptions } from './rk45'

const GAMMA = 1 + Math.SQRT1_2

/** Solves A x = b in place (A is n×n row-major, destroyed). Returns false if singular. */
function solve(A: Float64Array, b: Float64Array, n: number): boolean {
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r * n + c]) > Math.abs(A[p * n + c])) p = r
    const piv = A[p * n + c]
    if (piv === 0 || !Number.isFinite(piv)) return false
    if (p !== c) {
      for (let k = 0; k < n; k++) {
        const t = A[c * n + k]
        A[c * n + k] = A[p * n + k]
        A[p * n + k] = t
      }
      const t = b[c]
      b[c] = b[p]
      b[p] = t
    }
    for (let r = c + 1; r < n; r++) {
      const f = A[r * n + c] / piv
      if (f === 0) continue
      for (let k = c; k < n; k++) A[r * n + k] -= f * A[c * n + k]
      b[r] -= f * b[c]
    }
  }
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r]
    for (let k = r + 1; k < n; k++) s -= A[r * n + k] * b[k]
    b[r] = s / A[r * n + r]
  }
  return true
}

export function rosenbrock(f: Rhs, t0: number, y0: ArrayLike<number>, t1: number, opts: SolverOptions = {}): DenseSolution {
  const n = y0.length
  const rtol = opts.rtol ?? 1e-6
  const atol = opts.atol ?? 1e-9
  const span = t1 - t0
  const hmax = opts.hmax ?? Math.abs(span)
  const maxSteps = opts.maxSteps ?? 50_000
  const warnings: string[] = []

  const call = (t: number, y: Float64Array, out: Float64Array) => {
    const r = f(t, y)
    for (let i = 0; i < n; i++) out[i] = r[i]
  }

  let t = t0
  let y = Float64Array.from(y0)
  const f0 = new Float64Array(n)
  const f1 = new Float64Array(n)
  const ft = new Float64Array(n)
  const J = new Float64Array(n * n)
  const M = new Float64Array(n * n)
  const k1 = new Float64Array(n)
  const k2 = new Float64Array(n)
  const tmp = new Float64Array(n)
  const ynew = new Float64Array(n)
  call(t, y, f0)

  /** Forward-difference Jacobian and time derivative at (t, y), given f(t, y) = f0. */
  const jacobian = () => {
    for (let j = 0; j < n; j++) {
      const d = Math.sqrt(Number.EPSILON) * Math.max(Math.abs(y[j]), atol / rtol, 1e-8)
      const keep = y[j]
      y[j] = keep + d
      call(t, y, tmp)
      y[j] = keep
      for (let i = 0; i < n; i++) J[i * n + j] = (tmp[i] - f0[i]) / d
    }
    const dt = Math.sqrt(Number.EPSILON) * Math.max(Math.abs(t), 1)
    call(t + dt, y, tmp)
    for (let i = 0; i < n; i++) ft[i] = (tmp[i] - f0[i]) / dt
  }

  const norm = (v: Float64Array, a: Float64Array, b: Float64Array) => {
    let s = 0
    for (let i = 0; i < n; i++) s += (v[i] / (atol + rtol * Math.max(Math.abs(a[i]), Math.abs(b[i])))) ** 2
    return Math.sqrt(s / n)
  }

  // Per accepted step: y_n, y_{n+1}, f_n, f_{n+1} for Hermite interpolation.
  const tsList: number[] = [t0]
  const dense: number[] = []

  let h = opts.h0 ?? Math.min(hmax, Math.abs(span) * 1e-3 || 1e-6)
  let steps = 0
  let rejected = 0
  let needJac = true
  if (span <= 0) warnings.push('Leeres Zeitintervall.')

  while (span > 0 && t < t1) {
    if (steps >= maxSteps) {
      warnings.push(`Abbruch nach ${maxSteps} Schritten bei t = ${t.toPrecision(4)}.`)
      break
    }
    if (t + h > t1) h = t1 - t
    if (needJac) jacobian()

    // M = I − γ h J
    for (let i = 0; i < n * n; i++) M[i] = -GAMMA * h * J[i]
    for (let i = 0; i < n; i++) M[i * n + i] += 1

    // stage 1: (I − γhJ) k1 = f(t, y) + γ h f_t
    for (let i = 0; i < n; i++) k1[i] = f0[i] + GAMMA * h * ft[i]
    let ok = solve(Float64Array.from(M), k1, n)
    // stage 2: (I − γhJ) k2 = f(t + h, y + h k1) − γ h f_t − 2 k1
    if (ok) {
      for (let i = 0; i < n; i++) tmp[i] = y[i] + h * k1[i]
      call(t + h, tmp, k2)
      for (let i = 0; i < n; i++) k2[i] = k2[i] - GAMMA * h * ft[i] - 2 * k1[i]
      ok = solve(Float64Array.from(M), k2, n)
    }
    let err = Infinity
    if (ok) {
      for (let i = 0; i < n; i++) {
        ynew[i] = y[i] + h * (1.5 * k1[i] + 0.5 * k2[i])
        tmp[i] = h * 0.5 * (k1[i] + k2[i]) // ROS2 minus linearly implicit Euler
      }
      err = norm(tmp, y, ynew)
    }

    if (Number.isFinite(err) && err <= 1) {
      call(t + h, ynew, f1)
      for (let i = 0; i < n; i++) dense.push(y[i], ynew[i], f0[i], f1[i])
      t += h
      tsList.push(t)
      steps++
      y = Float64Array.from(ynew)
      f0.set(f1)
      needJac = true
      h = Math.min(hmax, h * Math.min(4, Math.max(0.2, 0.9 / Math.sqrt(Math.max(err, 1e-10)))))
    } else {
      rejected++
      needJac = false // same point: the Jacobian is still valid
      h *= Number.isFinite(err) ? Math.max(0.2, 0.9 / Math.sqrt(err)) : 0.2
      if (h < 1e-14 * Math.max(1, Math.abs(t))) {
        warnings.push(`Schrittweite zu klein bei t = ${t.toPrecision(4)}.`)
        break
      }
    }
  }

  const ts = Float64Array.from(tsList)
  const coeffs = Float64Array.from(dense)
  const tEnd = ts[ts.length - 1]

  const at = (tq: number, out = new Float64Array(n)) => {
    if (steps === 0) {
      out.set(Float64Array.from(y0))
      return out
    }
    const tc = Math.min(Math.max(tq, t0), tEnd)
    let lo = 0
    let hi = steps - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (ts[mid] <= tc) lo = mid
      else hi = mid - 1
    }
    const hk = ts[lo + 1] - ts[lo]
    const s = hk > 0 ? (tc - ts[lo]) / hk : 0
    // cubic Hermite basis
    const h00 = (1 + 2 * s) * (1 - s) ** 2
    const h10 = s * (1 - s) ** 2
    const h01 = s * s * (3 - 2 * s)
    const h11 = s * s * (s - 1)
    const base = lo * n * 4
    for (let i = 0; i < n; i++) {
      const o = base + i * 4
      out[i] = h00 * coeffs[o] + h01 * coeffs[o + 1] + hk * (h10 * coeffs[o + 2] + h11 * coeffs[o + 3])
    }
    return out
  }

  return {
    solver: 'rosenbrock',
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
