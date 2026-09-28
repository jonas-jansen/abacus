// Eigen-analysis of a real 2×2 matrix A = [[a, b], [c, d]], shared by the planar linear
// applets (continuous, discrete, Romeo & Julia).

import { formatNumber, liste, type Mark, type Observable } from '@abacus/applet-core'

export const EPS = 1e-9

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
  if (Math.abs(b) > EPS) return [b, l - a]
  if (Math.abs(c) > EPS) return [l - d, c]
  return Math.abs(a - l) <= Math.abs(d - l) ? [1, 0] : [0, 1]
}

/** Eigenvalues as a readout; for real ones the invariant lines light up in the phase plane. */
export function eigenReadout(a: number, b: number, c: number, d: number, extra: Pick<Observable, 'note'> = {}): Observable {
  const e = eigen(a, b, c, d)
  if (e.complex) return liste('Eigenwerte', `${formatNumber(e.complex.re, 3)} ± ${formatNumber(e.complex.im, 3)} i`, extra)
  return liste('Eigenwerte', e.real, {
    ...extra,
    marks: e.real.map((l, item): Mark => {
      const [vx, vy] = eigenvector(a, b, c, d, l)
      return { kind: 'line', x: 0, y: 0, slope: vx === 0 ? Infinity : vy / vx, in: 'phase', item }
    }),
  })
}

/** Type of the equilibrium of y' = A y, from trace and determinant. */
export function classify(tr: number, det: number): string {
  const disc = tr * tr - 4 * det
  if (det < -EPS) return 'Sattel'
  if (Math.abs(det) <= EPS) return 'entartet'
  if (disc < -EPS) return Math.abs(tr) <= EPS ? 'Zentrum' : tr < 0 ? 'stabiler Strudel' : 'instabiler Strudel'
  return tr < 0 ? 'stabiler Knoten' : 'instabiler Knoten'
}

/** Spectral radius: the largest |λ|. Decides the fate of x_{n+1} = A x_n. */
export function spectralRadius(e: Eigen): number {
  return e.complex ? Math.hypot(e.complex.re, e.complex.im) : Math.max(...e.real.map(Math.abs))
}

export const ORIGIN: Mark = { kind: 'point', x: 0, y: 0, in: 'phase' }
