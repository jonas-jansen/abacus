/**
 * The coordinate contract (§5.1): one Frame, built here, read by both the SVG and the canvas
 * layer. Neither layer computes its own scales.
 *
 * Text width is estimated (chars × fontSize × 0.6) instead of measured, so server and
 * client compute identical margins without a DOM.
 */

import { decimalsOf, formatFixed } from './format'

export type Range = readonly [number, number]

export interface Frame {
  width: number
  height: number
  margin: { top: number; right: number; bottom: number; left: number }
  /** The data rectangle, in figure coordinates. */
  plot: { x: number; y: number; w: number; h: number }
  /** Data → px in plot-area coordinates (origin at the top left of the data rectangle). */
  xScale: (v: number) => number
  yScale: (v: number) => number
  xInvert: (px: number) => number
  yInvert: (px: number) => number
  xTicks: number[]
  yTicks: number[]
  xTickLabels: string[]
  yTickLabels: string[]
  xDomain: Range
  yDomain: Range
  fontSize: number
}

export interface FrameInput {
  width: number
  height: number
  x: Range
  y: Range
  /** Index axes (n) snap ticks to integers. */
  xInteger?: boolean
  yInteger?: boolean
  xLabel?: string
  yLabel?: string
}

export const TICK = 4
export const PX_PER_X_TICK = 60
export const PX_PER_Y_TICK = 40

/** Never below 11 px (§5.6): drop labels rather than shrink. */
export const fontSizeFor = (width: number) => (width < 400 ? 11 : 12)

export const estimateTextWidth = (text: string, fontSize: number) => text.length * fontSize * 0.6

/** Ticks on a 1–2–5 ladder, at most about `maxCount` of them. */
export function niceTicks(lo: number, hi: number, maxCount: number, integer = false): { ticks: number[]; step: number } {
  if (!(hi > lo)) hi = lo + 1
  const raw = (hi - lo) / Math.max(1, maxCount)
  const mag = 10 ** Math.floor(Math.log10(raw))
  const r = raw / mag
  let step = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * mag
  if (integer) step = Math.max(1, Math.round(step))
  const decimals = decimalsOf(step)
  const ticks: number[] = []
  const first = Math.ceil(lo / step - 1e-9)
  const last = Math.floor(hi / step + 1e-9)
  for (let k = first; k <= last && ticks.length < 1000; k++) ticks.push(Number((k * step).toFixed(decimals)))
  return { ticks, step }
}

function safeRange([a, b]: Range): Range {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return [0, 1]
  if (a === b) return [a - 1, b + 1]
  return a < b ? [a, b] : [b, a]
}

export function makeFrame(input: FrameInput): Frame {
  const { width, height } = input
  const fontSize = fontSizeFor(width)
  const xDomain = safeRange(input.x)
  const yDomain = safeRange(input.y)

  const yT = niceTicks(yDomain[0], yDomain[1], Math.max(2, Math.floor(height / PX_PER_Y_TICK)), input.yInteger)
  const yTickLabels = yT.ticks.map((v) => formatFixed(v, decimalsOf(yT.step)))
  const yLabelWidth = Math.max(0, ...yTickLabels.map((s) => estimateTextWidth(s, fontSize)))

  const left = Math.ceil(yLabelWidth + TICK + 6 + 4)
  const top = Math.ceil(input.yLabel ? fontSize * 2 : fontSize * 0.8)
  const bottom = Math.ceil(fontSize + TICK + 6 + (input.xLabel ? fontSize * 1.6 : 0) + 2)

  const xT = niceTicks(xDomain[0], xDomain[1], Math.max(2, Math.floor((width - left) / PX_PER_X_TICK)), input.xInteger)
  const xTickLabels = xT.ticks.map((v) => formatFixed(v, decimalsOf(xT.step)))
  const lastX = xTickLabels[xTickLabels.length - 1] ?? ''
  const right = Math.ceil(Math.max(10, estimateTextWidth(lastX, fontSize) / 2 + 2))

  const plot = {
    x: left,
    y: top,
    w: Math.max(1, width - left - right),
    h: Math.max(1, height - top - bottom),
  }
  const [x0, x1] = xDomain
  const [y0, y1] = yDomain
  const sx = plot.w / (x1 - x0)
  const sy = plot.h / (y1 - y0)

  return {
    width,
    height,
    margin: { top, right, bottom, left },
    plot,
    xScale: (v) => (v - x0) * sx,
    yScale: (v) => plot.h - (v - y0) * sy,
    xInvert: (px) => x0 + px / sx,
    yInvert: (px) => y0 + (plot.h - px) / sy,
    xTicks: xT.ticks,
    yTicks: yT.ticks,
    xTickLabels,
    yTickLabels,
    xDomain,
    yDomain,
    fontSize,
  }
}

/** A padded data range for auto-scaling; `null` input gives [0, 1]. */
export function padRange(r: Range | null, pad = 0.05): Range {
  if (!r) return [0, 1]
  const [a, b] = r
  if (a === b) return a === 0 ? [-1, 1] : [a - Math.abs(a) * 0.5, b + Math.abs(b) * 0.5]
  const d = (b - a) * pad
  return [a - d, b + d]
}
