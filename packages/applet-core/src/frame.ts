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
  /** The y axis is logarithmic. */
  yLog?: boolean
  /** Tick labels are scaled by 10^exp (0: not scaled); the axis shows the factor. */
  xExp?: number
  yExp?: number
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
  /** Logarithmic y axis: equal distances are equal factors. The domain must be positive. */
  yLog?: boolean
}

export const TICK = 4
/** How far the axes run past the plot, into their arrowheads. */
export const AXIS_OVERHANG = 12
export const PX_PER_X_TICK = 60
export const PX_PER_Y_TICK = 40

/** Never below 11 px (§5.6): drop labels rather than shrink. */
export const fontSizeFor = (width: number) => (width < 400 ? 11 : 12)

export const estimateTextWidth = (text: string, fontSize: number) => text.length * fontSize * 0.6

/** Rough width of a TeX-lite axis label (drawn at 1,15 × the tick size). */
export const labelWidth = (tex: string, fontSize: number) =>
  estimateTextWidth(tex.replace(/\\[a-zA-Z]+/g, 'x').replace(/[{}_^]/g, ''), fontSize * 1.15)

/** The ×10^k badge of an axis: text and its padding. */
export const FACTOR_WIDTH = (fontSize: number) => estimateTextWidth('×10−00', fontSize) + 12

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
  const log = !!input.yLog
  const yDomain = log ? positiveRange(input.y) : safeRange(input.y)

  const yT = log ? logTicks(yDomain, Math.max(2, Math.floor(height / PX_PER_Y_TICK))) : niceTicks(yDomain[0], yDomain[1], Math.max(2, Math.floor(height / PX_PER_Y_TICK)), input.yInteger)
  const yScaled = log ? { labels: yT.ticks.map(powerLabel), exp: 0 } : scaledLabels(yT.ticks, yT.step)
  const yTickLabels = yScaled.labels
  // a fixed minimum width, so the plot does not shift sideways while zooming or dragging
  const yLabelWidth = Math.max(estimateTextWidth('−0,000', fontSize), ...yTickLabels.map((s) => estimateTextWidth(s, fontSize)))

  // and room for the y axis's power-of-ten badge, left of the upper tip
  const left = Math.ceil(Math.max(yLabelWidth + TICK + 6 + 4, yScaled.exp ? TICK + 8 + FACTOR_WIDTH(fontSize) + 2 : 0))
  // room above the plot for the y arrow and the label beside its tip
  const top = Math.ceil(AXIS_OVERHANG + (input.yLabel ? fontSize * 1.2 : 4))
  const bottom = Math.ceil(fontSize + TICK + 6 + 2)

  const xT = niceTicks(xDomain[0], xDomain[1], Math.max(2, Math.floor((width - left) / PX_PER_X_TICK)), input.xInteger)
  const xScaled = scaledLabels(xT.ticks, xT.step)
  const xTickLabels = xScaled.labels
  // the x variable (and its factor) sits right of the arrow tip
  // right of the plot: the x variable after the arrow tip, and a factor after the last number
  const tail = AXIS_OVERHANG + (input.xLabel ? 5 + labelWidth(input.xLabel, fontSize) : 4) + 2
  const lastHalf = Math.max(0, ...xTickLabels.slice(-1).map((s) => estimateTextWidth(s, fontSize) / 2))
  // the x factor starts where the x variable does (just right of the tip), or after the last number
  const factorRoom = xScaled.exp ? Math.max(AXIS_OVERHANG + 2, lastHalf + 6) + FACTOR_WIDTH(fontSize) + 2 : 0
  const right = Math.ceil(Math.max(tail, factorRoom, estimateTextWidth('0,000', fontSize) / 2 + 2, lastHalf + 2))

  const plot = {
    x: left,
    y: top,
    w: Math.max(1, width - left - right),
    h: Math.max(1, height - top - bottom),
  }
  const [x0, x1] = xDomain
  // on a log axis, positions are linear in log₁₀ of the value
  const ty = log ? Math.log10 : (v: number) => v
  const tyInv = log ? (u: number) => 10 ** u : (u: number) => u
  const [y0, y1] = [ty(yDomain[0]), ty(yDomain[1])]
  const sx = plot.w / (x1 - x0)
  const sy = plot.h / (y1 - y0)

  return {
    width,
    height,
    margin: { top, right, bottom, left },
    plot,
    xScale: (v) => (v - x0) * sx,
    yScale: (v) => plot.h - (ty(v) - y0) * sy,
    xInvert: (px) => x0 + px / sx,
    yInvert: (px) => tyInv(y0 + (plot.h - px) / sy),
    xTicks: xT.ticks,
    yTicks: yT.ticks,
    xTickLabels,
    yTickLabels,
    xDomain,
    yDomain,
    fontSize,
    yLog: log,
    xExp: xScaled.exp,
    yExp: yScaled.exp,
  }
}

/**
 * Tick labels that stay short: from 10⁴ on, or below 10⁻³, the ticks are written as mantissas
 * and the common power of ten goes to the axis (·10⁴). Keeps labels narrow and the plot still.
 */
function scaledLabels(ticks: number[], step: number): { labels: string[]; exp: number } {
  const max = Math.max(0, ...ticks.map(Math.abs))
  const e = max > 0 ? Math.floor(Math.log10(max) + 1e-9) : 0
  if (e < 4 && !(e <= -3 && max > 0)) return { labels: ticks.map((v) => formatFixed(v, decimalsOf(step))), exp: 0 }
  const f = 10 ** e
  const d = decimalsOf(Number((step / f).toPrecision(6)))
  return { labels: ticks.map((v) => formatFixed(v / f, d)), exp: e }
}

function positiveRange([a, b]: Range): Range {
  const hi = Number.isFinite(b) && b > 0 ? b : 1
  const lo = Number.isFinite(a) && a > 0 && a < hi ? a : hi / 1000
  return [lo, hi]
}

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }

/** 1, 10, 100 as numbers; everything else as a power: 10⁻³. */
function powerLabel(v: number): string {
  const k = Math.round(Math.log10(v))
  if (k >= 0 && k <= 3) return String(10 ** k)
  return '10' + [...String(k)].map((c) => SUP[c] ?? c).join('')
}

/** Powers of ten in the domain, every k-th one if there are too many. */
function logTicks([lo, hi]: Range, maxCount: number): { ticks: number[]; step: number } {
  const a = Math.ceil(Math.log10(lo) - 1e-9)
  const b = Math.floor(Math.log10(hi) + 1e-9)
  const every = Math.max(1, Math.ceil((b - a + 1) / maxCount))
  const ticks: number[] = []
  for (let k = b; k >= a; k -= every) ticks.unshift(10 ** k)
  return { ticks, step: every }
}

/** A padded data range for auto-scaling; `null` input gives [0, 1]. */
/**
 * An automatic value range for quantities that cannot be negative (populations,
 * concentrations): from 0 when the data come near it, so the axis does not start at an
 * arbitrary 1 and exaggerate the change. Data far from 0 (a temperature of 280–315 K) keep
 * their tight range.
 */
export function valueRange(r: Range | null, pad = 0.05): Range {
  if (r && r[0] >= 0 && r[1] > 0 && r[0] <= r[1] / 2) return [0, r[1] + (r[1] - r[0]) * pad]
  return padRange(r, pad)
}

export function padRange(r: Range | null, pad = 0.05): Range {
  if (!r) return [0, 1]
  const [a, b] = r
  if (a === b) return a === 0 ? [-1, 1] : [a - Math.abs(a) * 0.5, b + Math.abs(b) * 0.5]
  const d = (b - a) * pad
  return [a - d, b + d]
}
