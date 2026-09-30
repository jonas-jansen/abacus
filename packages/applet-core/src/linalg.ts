/**
 * Linear algebra for the applets: eigen-analysis of 2×2 matrices (planar linear systems),
 * eigenvalues of small n×n matrices (Leslie, compartment models), and equilibria of planar
 * nonlinear systems with their Jacobian (stability by linearisation, slides II 49–55, IV 33–37).
 */

import { liste } from './observables'
import { formatNumber } from './format'
import type { Mark, Observable } from './model'

/** Below this, a determinant, trace or discriminant counts as zero. */
export const EIGEN_EPS = 1e-9

// ---------------------------------------------------------------------------------------
// 2×2: A = [[a, b], [c, d]]

export interface Eigen {
  tr: number
  det: number
  /** Real eigenvalues, ascending; empty when they are complex. */
  real: number[]
  /** Complex pair re ± i·im (im > 0), or null. */
  complex: { re: number; im: number } | null
}

export function eigen(a: number, b: number, c: number, d: number): Eigen {
  const tr = a + d
  const det = a * d - b * c
  const disc = tr * tr - 4 * det
  if (disc >= 0) return { tr, det, real: [(tr - Math.sqrt(disc)) / 2, (tr + Math.sqrt(disc)) / 2], complex: null }
  return { tr, det, real: [], complex: { re: tr / 2, im: Math.sqrt(-disc) / 2 } }
}

/** A nonzero solution of (A − λI)v = 0. */
export function eigenvector(a: number, b: number, c: number, d: number, l: number): [number, number] {
  if (Math.abs(b) > EIGEN_EPS) return [b, l - a]
  if (Math.abs(c) > EIGEN_EPS) return [l - d, c]
  return Math.abs(a - l) <= Math.abs(d - l) ? [1, 0] : [0, 1]
}

/**
 * Eigenvalues as a readout; for real ones the invariant lines light up in the phase plane
 * (through `at`, the origin unless given: an equilibrium of a nonlinear system).
 */
export function eigenReadout(a: number, b: number, c: number, d: number, extra: Pick<Observable, 'note'> & { at?: readonly [number, number] } = {}): Observable {
  const { at = [0, 0], ...rest } = extra
  const e = eigen(a, b, c, d)
  if (e.complex) return liste('Eigenwerte', `${formatNumber(e.complex.re, 3)} ± ${formatNumber(e.complex.im, 3)} i`, rest)
  return liste('Eigenwerte', e.real, {
    ...rest,
    marks: e.real.map((l, item): Mark => {
      const [vx, vy] = eigenvector(a, b, c, d, l)
      return { kind: 'line', x: at[0], y: at[1], slope: vx === 0 ? Infinity : vy / vx, in: 'phase', item }
    }),
  })
}

/** Type of the equilibrium of y' = A y, from trace and determinant. */
export function classify(tr: number, det: number): string {
  const disc = tr * tr - 4 * det
  if (det < -EIGEN_EPS) return 'Sattel'
  if (Math.abs(det) <= EIGEN_EPS) return 'entartet'
  if (disc < -EIGEN_EPS) return Math.abs(tr) <= EIGEN_EPS ? 'Zentrum' : tr < 0 ? 'stabiler Strudel' : 'instabiler Strudel'
  return tr < 0 ? 'stabiler Knoten' : 'instabiler Knoten'
}

/** Spectral radius: the largest |λ|. Decides the fate of x_{n+1} = A x_n. */
export function spectralRadius(e: Eigen): number {
  return e.complex ? Math.hypot(e.complex.re, e.complex.im) : Math.max(...e.real.map(Math.abs))
}

export const ORIGIN: Mark = { kind: 'point', x: 0, y: 0, in: 'phase' }

// ---------------------------------------------------------------------------------------
// n×n (small n): x_{n+1} = A x_n

export type Matrix = readonly (readonly number[])[]

export function matVec(A: Matrix, x: ArrayLike<number>): number[] {
  return A.map((row) => row.reduce((s, v, j) => s + v * x[j], 0))
}

export interface Complex {
  re: number
  im: number
}

/**
 * Eigenvalues of a small real matrix (n ≤ 8): the characteristic polynomial by
 * Faddeev–LeVerrier, its roots by Durand–Kerner. Plenty for the models here, and — unlike
 * power iteration — right also when several eigenvalues share the largest modulus
 * (the Leslie example of the slides: λ₁ and a complex pair, all of modulus 3/∛50).
 * Sorted by modulus, largest first.
 */
export function eigenvalues(A: Matrix): Complex[] {
  const n = A.length
  if (n === 0) return []
  if (n === 1) return [{ re: A[0][0], im: 0 }]
  // p(λ) = λⁿ + c₁ λⁿ⁻¹ + … + cₙ
  const c = new Array<number>(n + 1).fill(0)
  c[0] = 1
  let M = A.map((row) => row.map(() => 0))
  for (let k = 1; k <= n; k++) {
    // M_k = A M_{k−1} + c_{k−1} I,  c_k = −tr(A M_k) / k
    const next = A.map((_, i) => A.map((__, j) => A[i].reduce((s, v, l) => s + v * M[l][j], 0) + (i === j ? c[k - 1] : 0)))
    M = next
    let tr = 0
    for (let i = 0; i < n; i++) tr += A[i].reduce((s, v, l) => s + v * M[l][i], 0)
    c[k] = -tr / k
  }
  // Durand–Kerner, started on a circle a little larger than the Cauchy bound
  const bound = 1 + Math.max(...c.slice(1).map(Math.abs))
  let z: Complex[] = Array.from({ length: n }, (_, i) => ({ re: bound * 0.9 * Math.cos((2 * Math.PI * i) / n + 0.4), im: bound * 0.9 * Math.sin((2 * Math.PI * i) / n + 0.4) }))
  const mul = (a: Complex, b: Complex): Complex => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re })
  const div = (a: Complex, b: Complex): Complex => {
    const d = b.re * b.re + b.im * b.im || 1e-300
    return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }
  }
  const p = (x: Complex): Complex => c.reduce<Complex>((acc, ck) => ({ re: mul(acc, x).re + ck, im: mul(acc, x).im }), { re: 0, im: 0 })
  for (let iter = 0; iter < 500; iter++) {
    let moved = 0
    z = z.map((zi, i) => {
      let den: Complex = { re: 1, im: 0 }
      for (let j = 0; j < n; j++) if (j !== i) den = mul(den, { re: zi.re - z[j].re, im: zi.im - z[j].im })
      const step = div(p(zi), den)
      moved = Math.max(moved, Math.hypot(step.re, step.im))
      return { re: zi.re - step.re, im: zi.im - step.im }
    })
    if (moved < 1e-14 * bound) break
  }
  // clean round-off: tiny imaginary parts are real, and conjugates are exact
  return z
    .map((v) => ({ re: v.re, im: Math.abs(v.im) < 1e-9 * bound ? 0 : v.im }))
    .sort((a, b) => Math.hypot(b.re, b.im) - Math.hypot(a.re, a.im) || b.re - a.re || b.im - a.im)
}

/** ρ(A) = max |λ|: x_{n+1} = A x_n goes to 0 for every start iff ρ(A) < 1 (slide II 36). */
export function spectralRadiusOf(A: Matrix): number {
  return Math.max(0, ...eigenvalues(A).map((l) => Math.hypot(l.re, l.im)))
}

/** An eigenvalue as text, e.g. "1,2" or "−0,3 ± 0,4 i" (conjugates are shown once). */
export function complexText(l: Complex, digits = 3): string {
  return l.im === 0 ? formatNumber(l.re, digits) : `${formatNumber(l.re, digits)} ± ${formatNumber(Math.abs(l.im), digits)} i`
}

/** The eigenvalues as readout values, a conjugate pair shown once. */
export function eigenvalueTexts(ls: readonly Complex[], digits = 3): string[] {
  const out: string[] = []
  for (const l of ls) if (l.im >= 0) out.push(complexText(l, digits))
  return out
}

// ---------------------------------------------------------------------------------------
// Nonlinear systems: Jacobian, equilibria (ODE) and fixed points (maps) in the plane

export type Field = (x: readonly number[]) => ArrayLike<number>

/** J_f(x) by central differences: J[i][j] = ∂f_i/∂x_j. */
export function jacobian(f: Field, x: readonly number[]): number[][] {
  const n = x.length
  const J = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  for (let j = 0; j < n; j++) {
    const h = 1e-6 * (1 + Math.abs(x[j]))
    const xp = [...x]
    const xm = [...x]
    xp[j] += h
    xm[j] -= h
    const fp = f(xp)
    const fm = f(xm)
    for (let i = 0; i < n; i++) J[i][j] = (fp[i] - fm[i]) / (2 * h)
  }
  return J
}

/** Newton's method for g(x) = 0 in the plane (slide II 60); null if it does not converge. */
export function newton2(g: Field, x0: readonly [number, number], maxIter = 60): [number, number] | null {
  let [x, y] = x0
  for (let k = 0; k < maxIter; k++) {
    const v = g([x, y])
    const J = jacobian(g, [x, y])
    const det = J[0][0] * J[1][1] - J[0][1] * J[1][0]
    if (!Number.isFinite(det) || Math.abs(det) < 1e-300) return null
    const dx = (-v[0] * J[1][1] + v[1] * J[0][1]) / det
    const dy = (-v[1] * J[0][0] + v[0] * J[1][0]) / det
    x += dx
    y += dy
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    if (Math.hypot(dx, dy) <= 1e-12 * (1 + Math.hypot(x, y))) {
      const r = g([x, y])
      return Math.hypot(r[0], r[1]) < 1e-8 * (1 + Math.hypot(x, y)) ? [x, y] : null
    }
  }
  return null
}

export interface Equilibrium {
  x: [number, number]
  /** Jacobian of the right-hand side (ODE) or of the map, at x. */
  J: number[][]
  eigen: Eigen
  /** ODE: the type by trace and determinant (Sattel, stabiler Knoten, …); map: stabil/instabil. */
  typ: string
  stable: boolean
}

/**
 * All equilibria of a planar system in a box: f(x) = 0 for x' = f(x) (`kind: 'ode'`), or
 * f(x) = x for x_{n+1} = f(x_n) (`kind: 'map'`). Newton from a grid of starts, duplicates
 * merged; each with its Jacobian and whether it is stable (ODE: Re λ < 0, i.e. tr < 0 and
 * det > 0; map: ρ(J) < 1).
 */
export function equilibria2(f: Field, box: readonly [readonly [number, number], readonly [number, number]], kind: 'ode' | 'map' = 'ode', grid = 12): Equilibrium[] {
  const g: Field = kind === 'ode' ? f : (x) => {
    const v = f(x)
    return [v[0] - x[0], v[1] - x[1]]
  }
  const [[x0, x1], [y0, y1]] = box
  const scale = Math.max(x1 - x0, y1 - y0)
  const found: [number, number][] = []
  for (let i = 0; i <= grid; i++) {
    for (let j = 0; j <= grid; j++) {
      const r = newton2(g, [x0 + ((x1 - x0) * i) / grid, y0 + ((y1 - y0) * j) / grid])
      if (!r) continue
      const inBox = r[0] >= x0 - 1e-9 * scale && r[0] <= x1 + 1e-9 * scale && r[1] >= y0 - 1e-9 * scale && r[1] <= y1 + 1e-9 * scale
      if (!inBox || found.some((q) => Math.hypot(q[0] - r[0], q[1] - r[1]) < 1e-6 * scale)) continue
      // snap round-off: an equilibrium at 0 is 0
      found.push([Math.abs(r[0]) < 1e-9 * scale ? 0 : r[0], Math.abs(r[1]) < 1e-9 * scale ? 0 : r[1]])
    }
  }
  return found
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map((x) => {
      const J = jacobian(f, x)
      const e = eigen(J[0][0], J[0][1], J[1][0], J[1][1])
      if (kind === 'map') {
        const stable = spectralRadius(e) < 1 - 1e-12
        return { x, J, eigen: e, typ: stable ? 'stabil' : 'instabil', stable }
      }
      const typ = classify(e.tr, e.det)
      return { x, J, eigen: e, typ, stable: e.tr < -EIGEN_EPS && e.det > EIGEN_EPS }
    })
}
