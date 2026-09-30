/**
 * The window of a zoomed or panned plot, as pure functions (useZoomPan wires them to the
 * pointer). A window is a range on each axis; on a logarithmic y axis it moves in log₁₀.
 */

import { MAX_ZOOM_OUT } from '@abacus/applet-core'

export type Win = { readonly x: readonly [number, number]; readonly y: readonly [number, number] }

/** No deeper than a million-fold: beyond that, double precision and the samples run out. */
export const MAX_ZOOM = 1e6

const ly = (yLog: boolean) => (v: number) => (yLog ? Math.log10(Math.max(v, 1e-300)) : v)
const lyInv = (yLog: boolean) => (u: number) => (yLog ? 10 ** u : u)

/** How much larger the full view is than the window (≥ 1; zoomed out counts as 1). */
export function magnification(full: Win, z: Win, yLog: boolean): number {
  const t = ly(yLog)
  const mx = (full.x[1] - full.x[0]) / Math.max(1e-300, z.x[1] - z.x[0])
  const my = (t(full.y[1]) - t(full.y[0])) / Math.max(1e-300, t(z.y[1]) - t(z.y[0]))
  return Math.max(1, mx, my)
}

/** Within the limits: at most MAX_ZOOM in, at most MAX_ZOOM_OUT times the full view out. */
export function allowed(full: Win, z: Win, yLog: boolean): boolean {
  const t = ly(yLog)
  const out = Math.max((z.x[1] - z.x[0]) / (full.x[1] - full.x[0]), (t(z.y[1]) - t(z.y[0])) / (t(full.y[1]) - t(full.y[0])))
  return magnification(full, z, yLog) <= MAX_ZOOM && !(out > MAX_ZOOM_OUT)
}

/** Pushed back up where the window would go below an axis' floor (time before 0, …). */
export function floored(z: Win, floors: { x: number; y: number }, yLog: boolean): Win {
  const fit = (r: readonly [number, number], lo: number) => (r[0] >= lo ? r : ([lo, lo + r[1] - r[0]] as const))
  return { x: fit(z.x, floors.x), y: yLog ? z.y : fit(z.y, floors.y) }
}

/** Scaled by k (kx for x) about the data point (cx, cy): k < 1 zooms in. */
export function zoomedAbout(w: Win, cx: number, cy: number, k: number, kx: number, yLog: boolean): Win {
  const [t, ti] = [ly(yLog), lyInv(yLog)]
  const c = t(cy)
  const [ya, yb] = [t(w.y[0]), t(w.y[1])]
  return { x: [cx - (cx - w.x[0]) * kx, cx + (w.x[1] - cx) * kx], y: [ti(c - (c - ya) * k), ti(c + (yb - c) * k)] }
}

/** Moved with the pointer by (dx, dy) pixels over a plot of w × h pixels. */
export function panned(from: Win, dx: number, dy: number, w: number, h: number, yLog: boolean): Win {
  const [t, ti] = [ly(yLog), lyInv(yLog)]
  const sx = (from.x[1] - from.x[0]) / w
  const [ya, yb] = [t(from.y[0]), t(from.y[1])]
  const sy = (yb - ya) / h
  return { x: [from.x[0] - dx * sx, from.x[1] - dx * sx], y: [ti(ya + dy * sy), ti(yb + dy * sy)] }
}

/**
 * A pinch: scaled by k about the data point (x0, y0) under the first centre of the fingers,
 * then moved by (dx, dy) pixels as the centre moves.
 */
export function pinched(from: Win, x0: number, y0: number, k: number, dx: number, dy: number, w: number, h: number, yLog: boolean): Win {
  const [t, ti] = [ly(yLog), lyInv(yLog)]
  const [ya, yb] = [t(from.y[0]), t(from.y[1])]
  const c = t(y0)
  const shiftX = (dx * (from.x[1] - from.x[0]) * k) / w
  const shiftY = (dy * (yb - ya) * k) / h
  return {
    x: [x0 - (x0 - from.x[0]) * k - shiftX, x0 + (from.x[1] - x0) * k - shiftX],
    y: [ti(c - (c - ya) * k + shiftY), ti(c + (yb - c) * k + shiftY)],
  }
}
