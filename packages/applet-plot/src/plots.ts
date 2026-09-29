/**
 * Plot types (§5.4). A plot type knows how to pick series from a Run, choose default
 * domains, and draw geometry on a Surface. It knows nothing about parameters or models.
 */

import { extent, padRange, type Frame, type Range, type Run, type Series } from '@abacus/applet-core'
import type { Surface } from './surface'

export type Domain = Range | 'auto'

interface PlotCommon {
  title?: string
  xLabel?: string
  yLabel?: string
  x?: Domain
  y?: Domain
  /** width / height. Default 4:3 narrow, 16:10 wide; phase planes and cobwebs 1:1. */
  aspect?: number
  legend?: boolean
  /** Scale of the y axis at first. Default linear. */
  yScale?: 'linear' | 'log'
  /** Offer a switch between linear and logarithmic y axis (with an explanation). */
  logToggle?: boolean
  /** Why a log scale helps in this plot, added to the general explanation. */
  logHilfe?: string
  /** y range on the log scale (default: from the data). */
  yLogRange?: Range
}

export type PlotSpec =
  | (PlotCommon & { type: 'timeSeriesDiscrete'; series?: readonly string[]; connect?: boolean })
  | (PlotCommon & {
      type: 'timeSeriesContinuous'
      series?: readonly string[]
      /** Slope field of the scalar ODE behind the curves (needs `run.slope`). */
      field?: boolean
    })
  | (PlotCommon & { type: 'functionGraph'; series?: readonly string[]; diagonal?: boolean })
  | (PlotCommon & { type: 'cobweb'; f: string; orbit: string })
  | (PlotCommon & {
      type: 'phasePlane'
      /** The trajectory; without it only the field and overlays are drawn (vectors, lines). */
      xSeries?: string
      ySeries?: string
      /** Mark the start of the trajectory (default true). */
      start?: boolean
      /** A click on empty space adds a trajectory from there (phase portrait). */
      bahnen?: boolean
      /** Draw the nullclines y₁′ = 0 and y₂′ = 0 (needs `run.field`). */
      nullclines?: boolean
      /** Direction field of the ODE behind the trajectory (needs `run.field`). */
      field?: boolean
      /** Further series drawn as they are, in plane coordinates (x against y), e.g. vectors. */
      overlay?: readonly string[]
    })
  /** Many points without order, e.g. a bifurcation diagram; continuous series as lines on top. */
  | (PlotCommon & { type: 'scatter'; series?: readonly string[] })
  /** z = f(x, y) from `run.grids`, rotatable. Drawn by its own renderer (surface3d.ts). */
  | (PlotCommon & { type: 'surface3d'; grid: string; zLabel?: string })

export type PlotType = PlotSpec['type']

export interface PlotView {
  /** Visible steps for iterations (timeline); undefined = all. */
  steps?: number
  /** Visible time for continuous models (timeline); undefined = all. */
  time?: number
  /** Series switched off in the legend. */
  hidden?: ReadonlySet<string>
  /** Series pointed at in the legend: the others step back. */
  focus?: string | null
  /** Drawing a held comparison: no fields or other background, only the data. */
  ghost?: boolean
}

/** The series a plot shows: those it selects, minus the ones switched off. */
export const shown = (run: Run, ids: readonly string[] | undefined, view: PlotView) =>
  selected(run, ids).filter((s) => !view.hidden?.has(s.id))

export const isSquare = (spec: PlotSpec) => spec.type === 'phasePlane' || spec.type === 'cobweb' || spec.type === 'surface3d'

export function seriesById(run: Run, id: string | undefined): Series | undefined {
  return id === undefined ? undefined : run.series.find((s) => s.id === id)
}

export function selected(run: Run, ids: readonly string[] | undefined, kind?: Series['kind']): Series[] {
  if (ids) return ids.map((id) => seriesById(run, id)).filter((s): s is Series => !!s)
  return run.series.filter((s) => !kind || s.kind === kind)
}

export interface Domains {
  x: Range
  y: Range
  xInteger: boolean
}

/**
 * Domains are computed from the full run, not the visible steps, so the axes stay still
 * while the student steps through an iteration.
 */
export function plotDomains(spec: PlotSpec, run: Run): Domains {
  const pick = (d: Domain | undefined, auto: () => Range): Range => (d && d !== 'auto' ? d : auto())
  if (spec.yScale === 'log' && (spec.type === 'timeSeriesDiscrete' || spec.type === 'timeSeriesContinuous' || spec.type === 'functionGraph' || spec.type === 'scatter')) {
    // on a log axis only positive values have a place; the range comes from them
    const lin = plotDomains({ ...spec, yScale: 'linear' }, run)
    let lo = Infinity
    let hi = -Infinity
    for (const s of selected(run, spec.series)) {
      for (let i = 0; i < s.y.length; i++) {
        const v = s.y[i]
        if (v > 0 && Number.isFinite(v)) {
          if (v < lo) lo = v
          if (v > hi) hi = v
        }
      }
    }
    const auto: Range = lo <= hi ? [lo / 2, hi * 2] : [0.1, 10]
    return { ...lin, y: spec.yLogRange ?? auto }
  }
  switch (spec.type) {
    case 'surface3d':
      return { x: [0, 1], y: [0, 1], xInteger: false }
    case 'scatter':
    case 'timeSeriesDiscrete':
    case 'timeSeriesContinuous':
    case 'functionGraph': {
      const ss = selected(run, spec.series)
      return {
        x: pick(spec.x, () => extent(...ss.map((s) => s.x)) ?? [0, 1]),
        y: pick(spec.y, () => padRange(extent(...ss.map((s) => s.y)))),
        xInteger: spec.type === 'timeSeriesDiscrete',
      }
    }
    case 'cobweb': {
      const f = seriesById(run, spec.f)
      const x = pick(spec.x, () => extent(f?.x ?? []) ?? [0, 1])
      return { x, y: pick(spec.y, () => padRange(extent(f?.y ?? [], x), 0.02)), xInteger: false }
    }
    case 'phasePlane': {
      const sx = seriesById(run, spec.xSeries)
      const sy = seriesById(run, spec.ySeries)
      return {
        x: pick(spec.x, () => padRange(extent(sx?.y ?? []))),
        y: pick(spec.y, () => padRange(extent(sy?.y ?? []))),
        xInteger: false,
      }
    }
  }
}

function polyline(s: Surface, frame: Frame, xs: ArrayLike<number>, ys: ArrayLike<number>, count = xs.length) {
  let pen = false
  for (let i = 0; i < count; i++) {
    const X = frame.xScale(xs[i])
    const Y = frame.yScale(ys[i])
    if (!Number.isFinite(X) || !Number.isFinite(Y)) {
      pen = false
      continue
    }
    if (pen) s.lineTo(X, Y)
    else s.moveTo(X, Y)
    pen = true
  }
}

function dots(s: Surface, frame: Frame, xs: ArrayLike<number>, ys: ArrayLike<number>, count: number, r: number) {
  for (let i = 0; i < count; i++) {
    const X = frame.xScale(xs[i])
    const Y = frame.yScale(ys[i])
    if (Number.isFinite(X) && Number.isFinite(Y)) s.dot(X, Y, r)
  }
}

/** How many samples of a series the timeline shows. Continuous series are cut at `view.time`. */
export function visible(s: Series, view: PlotView): number {
  if (s.kind === 'discrete') return view.steps !== undefined ? Math.min(s.x.length, view.steps + 1) : s.x.length
  if (view.time === undefined) return s.x.length
  let lo = 0
  let hi = s.x.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (s.x[mid] <= view.time) lo = mid + 1
    else hi = mid
  }
  return Math.max(1, lo)
}

/** Where the timeline stands: a larger dot at the last visible sample. */
function head(s: Surface, frame: Frame, x: number, y: number, role: Series['role']) {
  const X = frame.xScale(x)
  const Y = frame.yScale(y)
  if (!Number.isFinite(X) || !Number.isFinite(Y)) return
  s.begin({ role, marker: 'circle' })
  s.dot(X, Y, 5)
  s.end()
}

/** The runs of a series between NaN gaps, as [start, end) index pairs. */
function runs(xs: ArrayLike<number>, ys: ArrayLike<number>, count: number): [number, number][] {
  const out: [number, number][] = []
  let start = -1
  for (let i = 0; i <= count; i++) {
    const ok = i < count && Number.isFinite(xs[i]) && Number.isFinite(ys[i])
    if (ok && start < 0) start = i
    if (!ok && start >= 0) {
      out.push([start, i])
      start = -1
    }
  }
  return out
}

/**
 * A continuous series as a line; with `fill` its pieces are also filled (translucent), with
 * `arrow` each piece ends in an arrowhead.
 */
function drawLine(s: Surface, frame: Frame, series: Series, count = series.x.length) {
  const { x, y } = series
  if (series.fill) {
    s.begin({ role: series.role, alpha: 0.16 })
    for (const [a, b] of runs(x, y, count)) {
      const pts = new Float64Array(2 * (b - a))
      for (let i = a; i < b; i++) {
        pts[2 * (i - a)] = frame.xScale(x[i])
        pts[2 * (i - a) + 1] = frame.yScale(y[i])
      }
      s.polygon(pts)
    }
    s.end()
  }
  s.begin({ role: series.role, ...(series.fill || series.arrow ? { dash: [], width: series.fill ? 1.25 : 2 } : {}) })
  polyline(s, frame, x, y, count)
  s.end()
  if (series.arrow) {
    s.begin({ role: series.role })
    for (const [a, b] of runs(x, y, count)) {
      if (b - a < 2) continue
      const X1 = frame.xScale(x[b - 1])
      const Y1 = frame.yScale(y[b - 1])
      const dx = X1 - frame.xScale(x[b - 2])
      const dy = Y1 - frame.yScale(y[b - 2])
      const m = Math.hypot(dx, dy)
      if (m < 1e-9) continue
      const [ux, uy] = [dx / m, dy / m]
      const L = Math.min(11, m * 0.6)
      const W = L * 0.5
      s.polygon(Float64Array.of(X1, Y1, X1 - ux * L - uy * W, Y1 - uy * L + ux * W, X1 - ux * L + uy * W, Y1 - uy * L - ux * W))
    }
    s.end()
  }
}

/** Opacity factor for a series while another one is pointed at in the legend. */
const dim = (series: Series, view: PlotView) => (view.focus && view.focus !== series.id ? 0.15 : 1)

const timed = (view: PlotView) => view.time !== undefined || view.steps !== undefined

/**
 * More points than pixels: one stroke per pixel column from the column's minimum to its
 * maximum, joined to the neighbouring column so a settled sequence still reads as a line.
 * A million steps draw as fast as a hundred, and look the same.
 */
function drawEnvelope(s: Surface, frame: Frame, xs: ArrayLike<number>, ys: ArrayLike<number>, count: number, role: Series['role']) {
  const w = Math.ceil(frame.plot.w)
  const lo = new Float64Array(w + 1).fill(Infinity)
  const hi = new Float64Array(w + 1).fill(-Infinity)
  for (let i = 0; i < count; i++) {
    const X = Math.round(frame.xScale(xs[i]))
    const Y = frame.yScale(ys[i])
    if (X < 0 || X > w || !Number.isFinite(Y)) continue
    if (Y < lo[X]) lo[X] = Y
    if (Y > hi[X]) hi[X] = Y
  }
  s.begin({ role, width: 2, dash: [] })
  let prev = -1
  for (let X = 0; X <= w; X++) {
    if (lo[X] > hi[X]) continue
    let a = lo[X]
    let b = hi[X]
    if (prev >= 0 && X - prev <= 2) {
      a = Math.min(a, hi[prev])
      b = Math.max(b, lo[prev])
    }
    s.moveTo(X, a)
    s.lineTo(X, b)
    prev = X
  }
  s.end()
}

/**
 * Unordered point clouds (bifurcation diagrams): one dot per occupied 2-px cell, so tens of
 * thousands of points stay cheap on the canvas and small in the server-rendered SVG. Dots
 * are zero-length round-capped strokes.
 */
function drawCloud(s: Surface, frame: Frame, series: Series) {
  const CELL = 2
  const cols = Math.ceil(frame.plot.w / CELL) + 1
  const rows = Math.ceil(frame.plot.h / CELL) + 1
  const seen = new Uint8Array(cols * rows)
  s.begin({ role: series.role, width: 1.6, dash: [], alpha: 0.75 })
  for (let i = 0; i < series.x.length; i++) {
    const X = frame.xScale(series.x[i])
    const Y = frame.yScale(series.y[i])
    if (!(X >= 0 && X <= frame.plot.w && Y >= 0 && Y <= frame.plot.h)) continue
    const c = Math.floor(X / CELL) + cols * Math.floor(Y / CELL)
    if (seen[c]) continue
    seen[c] = 1
    s.moveTo(X, Y)
    s.lineTo(X + 0.01, Y)
  }
  s.end()
}

/** Direction field: short strokes of equal length on a grid along the field; arrows for systems, plain strokes for slope fields. */
function drawField(s: Surface, frame: Frame, field: NonNullable<Run['field']>, arrows = true) {
  const spacing = 34
  const cols = Math.max(4, Math.round(frame.plot.w / spacing))
  const rows = Math.max(4, Math.round(frame.plot.h / spacing))
  const len = Math.min(frame.plot.w / cols, frame.plot.h / rows) * 0.36
  const heads: number[] = []
  s.begin({ role: 'ghost', width: 1.1, dash: [], alpha: 0.55 })
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const X = ((i + 0.5) * frame.plot.w) / cols
      const Y = ((j + 0.5) * frame.plot.h) / rows
      const [dx, dy] = field(frame.xInvert(X), frame.yInvert(Y))
      // direction in pixels (y axis points down)
      const px = frame.xScale(frame.xInvert(X) + dx) - X
      const py = frame.yScale(frame.yInvert(Y) + dy) - Y
      const m = Math.hypot(px, py)
      if (!(m > 1e-12)) continue
      const ux = px / m
      const uy = py / m
      s.moveTo(X - ux * len, Y - uy * len)
      s.lineTo(X + ux * len, Y + uy * len)
      heads.push(X + ux * len, Y + uy * len, ux, uy)
    }
  }
  s.end()
  if (!arrows) return
  s.begin({ role: 'ghost', alpha: 0.55 })
  for (let k = 0; k < heads.length; k += 4) {
    const [x, y, ux, uy] = heads.slice(k, k + 4)
    const a = 4.2
    s.polygon(Float64Array.of(x + ux * 1.5, y + uy * 1.5, x - ux * a - uy * a * 0.55, y - uy * a + ux * a * 0.55, x - ux * a + uy * a * 0.55, y - uy * a - ux * a * 0.55))
  }
  s.end()
}

/** Legend entries for the nullclines of a phase plane: y₁′ = 0 and y₂′ = 0. */
export function nullclineSeries(spec: PlotSpec): Series[] {
  if (spec.type !== 'phasePlane' || !spec.nullclines) return []
  const empty = new Float64Array()
  const name = (l: string | undefined, i: number) => `${l ?? `y_${i}`}' = 0`
  return [
    { id: '_null1', label: name(spec.xLabel, 1), name: 'Nullkline', kind: 'continuous', x: empty, y: empty, role: 'tertiary' },
    { id: '_null2', label: name(spec.yLabel, 2), name: 'Nullkline', kind: 'continuous', x: empty, y: empty, role: 'secondary' },
  ]
}

/**
 * Nullclines by marching squares: where the first (second) component of the field vanishes,
 * the flow runs vertically (horizontally). Where they cross is an equilibrium.
 */
function drawNullclines(s: Surface, frame: Frame, field: NonNullable<Run['field']>, view: PlotView) {
  const N = 60
  const [x0, x1] = frame.xDomain
  const [y0, y1] = frame.yDomain
  const xs = Array.from({ length: N + 1 }, (_, i) => x0 + ((x1 - x0) * i) / N)
  const ys = Array.from({ length: N + 1 }, (_, j) => y0 + ((y1 - y0) * j) / N)
  const F = xs.map((x) => ys.map((y) => field(x, y)))
  const X = frame.xScale
  const Y = frame.yScale
  ;([0, 1] as const).forEach((k) => {
    if (view.hidden?.has(k === 0 ? '_null1' : '_null2')) return
    s.begin({ role: k === 0 ? 'tertiary' : 'secondary', width: 2 })
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const c = [F[i][j][k], F[i + 1][j][k], F[i + 1][j + 1][k], F[i][j + 1][k]]
        const px = [xs[i], xs[i + 1], xs[i + 1], xs[i]]
        const py = [ys[j], ys[j], ys[j + 1], ys[j + 1]]
        const cuts: [number, number][] = []
        for (let e = 0; e < 4; e++) {
          const a = e
          const b = (e + 1) % 4
          if (c[a] === 0 || Math.sign(c[a]) === Math.sign(c[b])) continue
          const t = c[a] / (c[a] - c[b])
          cuts.push([px[a] + t * (px[b] - px[a]), py[a] + t * (py[b] - py[a])])
        }
        for (let m = 0; m + 1 < cuts.length; m += 2) {
          s.moveTo(X(cuts[m][0]), Y(cuts[m][1]))
          s.lineTo(X(cuts[m + 1][0]), Y(cuts[m + 1][1]))
        }
      }
    }
    s.end()
  })
}

/**
 * A further trajectory of a phase portrait: faint, with its start and an arrow showing the
 * direction of motion.
 */
export function drawBahn(s: Surface, frame: Frame, spec: PlotSpec, run: Run) {
  if (spec.type !== 'phasePlane') return
  const sx = seriesById(run, spec.xSeries)
  const sy = seriesById(run, spec.ySeries)
  if (!sx || !sy || sx.y.length === 0) return
  s.fade(0.6)
  if (sx.kind === 'discrete') drawDiscrete(s, frame, { ...sx, x: sx.y, y: sy.y }, sx.y.length, sx.y.length <= 400, false)
  else {
    s.begin({ role: 'primary', width: 1.5, dash: [] })
    polyline(s, frame, sx.y, sy.y)
    s.end()
    // an arrowhead a third of the way along
    const k = Math.max(1, Math.floor(sx.y.length / 3))
    const [ax, ay] = [frame.xScale(sx.y[k]), frame.yScale(sy.y[k])]
    const [dx, dy] = [ax - frame.xScale(sx.y[k - 1]), ay - frame.yScale(sy.y[k - 1])]
    const m = Math.hypot(dx, dy)
    if (m > 1e-9 && Number.isFinite(ax) && Number.isFinite(ay)) {
      const [ux, uy] = [dx / m, dy / m]
      s.begin({ role: 'primary' })
      s.polygon(Float64Array.of(ax + ux * 5, ay + uy * 5, ax - ux * 4 - uy * 4, ay - uy * 4 + ux * 4, ax - ux * 4 + uy * 4, ay - uy * 4 - ux * 4))
      s.end()
    }
  }
  s.begin({ role: 'primary', marker: 'circle' })
  s.dot(frame.xScale(sx.y[0]), frame.yScale(sy.y[0]), 3)
  s.end()
  s.fade(1)
}

const MAX_STAIRS = 4000
/** The cobweb fades from old steps to recent ones, so the direction of time is visible. */
const FADE_BANDS = 16

/**
 * How a discrete series is drawn depends on the room per step, not on the step count:
 * dots with a faint connector while there is room, a solid line once dots would merge, and
 * the envelope once there are more steps than pixels. Strokes never get thinner than 2 px.
 */
function drawDiscrete(s: Surface, frame: Frame, series: Series, count: number, connect: boolean, envelope = true) {
  const room = frame.plot.w / Math.max(1, series.x.length - 1)
  if (envelope && count > frame.plot.w) {
    drawEnvelope(s, frame, series.x, series.y, count, series.role)
    return
  }
  if (envelope && room < 3.5) {
    s.begin({ role: series.role, width: 2, dash: [] })
    polyline(s, frame, series.x, series.y, count)
    s.end()
    return
  }
  if (connect) {
    s.begin({ role: series.role, width: room < 9 ? 1 : 1.25, dash: [], alpha: 0.45 })
    polyline(s, frame, series.x, series.y, count)
    s.end()
  }
  s.begin({ role: series.role })
  dots(s, frame, series.x, series.y, count, room < 9 ? 2.4 : Math.min(4, Math.max(3, room / 4)))
  s.end()
}

function diagonal(s: Surface, frame: Frame) {
  const [a, b] = frame.xDomain
  s.begin({ role: 'reference' })
  polyline(s, frame, [a, b], [a, b])
  s.end()
}

export function drawPlot(s: Surface, frame: Frame, spec: PlotSpec, run: Run, view: PlotView = {}): void {
  switch (spec.type) {
    case 'surface3d':
      return
    case 'scatter':
      for (const series of selected(run, spec.series)) {
        if (series.kind === 'discrete') drawCloud(s, frame, series)
      }
      for (const series of selected(run, spec.series)) {
        if (series.kind === 'continuous') drawLine(s, frame, series)
      }
      return
    case 'timeSeriesDiscrete':
      for (const series of shown(run, spec.series, view)) {
        s.fade(dim(series, view))
        const count = visible(series, view)
        drawDiscrete(s, frame, series, count, spec.connect ?? series.connect ?? true)
        if (timed(view) && series.kind === 'discrete' && count <= frame.plot.w) head(s, frame, series.x[count - 1], series.y[count - 1], series.role)
      }
      s.fade(1)
      return
    case 'timeSeriesContinuous':
    case 'functionGraph':
      if (spec.type === 'functionGraph' && spec.diagonal && !view.ghost) diagonal(s, frame)
      if (spec.type === 'timeSeriesContinuous' && spec.field && run.slope && !view.ghost) {
        const f = run.slope
        drawField(s, frame, (t, x) => [1, f(t, x)], false)
      }
      for (const series of shown(run, spec.series, view)) {
        s.fade(dim(series, view))
        if (series.kind === 'discrete') {
          drawDiscrete(s, frame, series, visible(series, view), series.connect ?? true, series.role !== 'data')
          continue
        }
        // reference lines and the faint family stay whole; the solution itself runs with the timeline
        const cut = spec.type === 'timeSeriesContinuous' && series.role !== 'reference' && series.role !== 'ghost'
        const count = cut ? visible(series, view) : series.x.length
        drawLine(s, frame, series, count)
        if (cut && view.time !== undefined) head(s, frame, series.x[count - 1], series.y[count - 1], series.role)
      }
      s.fade(1)
      return
    case 'cobweb': {
      const f = seriesById(run, spec.f)
      const orbit = seriesById(run, spec.orbit)
      diagonal(s, frame)
      if (f) {
        s.begin({ role: f.role })
        polyline(s, frame, f.x, f.y)
        s.end()
      }
      if (!orbit || orbit.y.length === 0) return
      const k = visible(orbit, view) - 1
      const xs = orbit.y
      // Staircase (x₀, 0) → (x₀, x₁) → (x₁, x₁) → (x₁, x₂) → …
      // For very long orbits only the last MAX_STAIRS steps: earlier ones lie underneath anyway.
      const first = Math.max(0, k - MAX_STAIRS)
      const y0 = Math.min(Math.max(0, frame.yDomain[0]), frame.yDomain[1])
      const bands = Math.max(1, Math.min(FADE_BANDS, k - first))
      const width = k - first > 400 ? 1.25 : 1.75
      for (let b = 0; b < bands; b++) {
        const from = first + Math.floor(((k - first) * b) / bands)
        const to = first + Math.floor(((k - first) * (b + 1)) / bands)
        if (to <= from) continue
        s.begin({ role: 'secondary', width, dash: [], alpha: bands === 1 ? 1 : 0.25 + (0.75 * (b + 1)) / bands })
        s.moveTo(frame.xScale(xs[from]), frame.yScale(from === 0 ? y0 : xs[from]))
        for (let i = from; i < to; i++) {
          const X = frame.xScale(xs[i])
          const Xn = frame.xScale(xs[i + 1])
          if (!Number.isFinite(Xn)) break
          s.lineTo(X, frame.yScale(xs[i + 1]))
          s.lineTo(Xn, frame.yScale(xs[i + 1]))
        }
        s.end()
      }
      s.begin({ role: 'secondary', marker: 'circle' })
      if (Number.isFinite(xs[k])) s.dot(frame.xScale(xs[k]), frame.yScale(xs[k]), 4)
      s.end()
      return
    }
    case 'phasePlane': {
      if (spec.field && run.field && !view.ghost) drawField(s, frame, run.field)
      if (spec.nullclines && run.field && !view.ghost) drawNullclines(s, frame, run.field, view)
      for (const o of selected(run, spec.overlay ?? [])) drawLine(s, frame, o)
      const sx = seriesById(run, spec.xSeries)
      const sy = seriesById(run, spec.ySeries)
      if (!sx || !sy) return
      const count = visible(sx, view)
      if (sx.kind === 'discrete') {
        // x is not the index here, so no envelope; many points just become small dots.
        drawDiscrete(s, frame, { ...sx, x: sx.y, y: sy.y }, count, count <= 400, false)
      } else {
        s.begin({ role: 'primary' })
        polyline(s, frame, sx.y, sy.y, count)
        s.end()
      }
      if (spec.start !== false) {
        s.begin({ role: 'secondary', marker: 'square' })
        s.dot(frame.xScale(sx.y[0]), frame.yScale(sy.y[0]), 4)
        s.end()
      }
      if (timed(view)) head(s, frame, sx.y[count - 1], sy.y[count - 1], 'primary')
      return
    }
  }
}
