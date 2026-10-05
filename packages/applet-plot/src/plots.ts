/**
 * Plot types (§5.4). A plot type knows how to pick series from a Run, choose default
 * domains, and draw geometry on a Surface. It knows nothing about parameters or models.
 */

import { extent, padRange, valueRange, type Frame, type Range, type Run, type Series } from '@abacus/applet-core'
import { roleStyles } from './palette'
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
  /**
   * Values at the current step as bars: one per series (age classes, compartments), or one
   * per row of a grid over time (cells of a ring: grid x = step, y = cell). The axis covers
   * all steps, so it holds still while the timeline plays.
   */
  | (PlotCommon & { type: 'bars'; series?: readonly string[]; grid?: string; share?: boolean })
  /**
   * A grid over time as colours: x = step or time, y = e.g. the cell, colour = the value.
   * The timeline uncovers it column by column.
   */
  | (PlotCommon & { type: 'heatmap'; grid: string; zLabel?: string; zRange?: Range })

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
  /** Connect the points of sequences with a faint line (page setting; default true). */
  connect?: boolean
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
    case 'bars': {
      const b = barValues(spec, run)
      let hi = 0
      for (const col of b.columns) for (const v of col) if (Number.isFinite(v) && v > hi) hi = v
      return { x: pick(spec.x, () => [0.4, b.count + 0.6]), y: pick(spec.y, () => [0, hi > 0 ? hi * 1.05 : 1]), xInteger: true }
    }
    case 'heatmap': {
      const g = run.grids?.find((q) => q.id === spec.grid)
      if (!g || !g.x.length || !g.y.length) return { x: [0, 1], y: [0, 1], xInteger: false }
      const half = (a: Float64Array) => (a.length > 1 ? (a[a.length - 1] - a[0]) / (a.length - 1) / 2 : 0.5)
      return {
        x: pick(spec.x, () => [g.x[0] - half(g.x), g.x[g.x.length - 1] + half(g.x)]),
        y: pick(spec.y, () => [g.y[0] - half(g.y), g.y[g.y.length - 1] + half(g.y)]),
        xInteger: false,
      }
    }
    case 'scatter':
    case 'timeSeriesDiscrete':
    case 'timeSeriesContinuous':
    case 'functionGraph': {
      const ss = selected(run, spec.series)
      return {
        x: pick(spec.x, () => extent(...ss.map((s) => s.x)) ?? [0, 1]),
        // over time: a quantity that is never negative gets its axis from 0
        y: pick(spec.y, () => (spec.type === 'timeSeriesDiscrete' || spec.type === 'timeSeriesContinuous' ? valueRange : padRange)(extent(...ss.map((s) => s.y)))),
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

/**
 * What a bar plot shows over the steps: `columns[k]` are the bar heights at step k.
 * From series: bar i is series i. From a grid over time: bar j is row j (e.g. cell j).
 */
export function barValues(spec: Extract<PlotSpec, { type: 'bars' }>, run: Run): { count: number; columns: number[][]; roles: Series['role'][] } {
  let columns: number[][] = []
  let roles: Series['role'][] = []
  const g = spec.grid ? run.grids?.find((q) => q.id === spec.grid) : undefined
  if (g) {
    const [nx, ny] = [g.x.length, g.y.length]
    columns = Array.from({ length: nx }, (_, i) => Array.from({ length: ny }, (__, j) => g.z[j * nx + i]))
    roles = Array.from({ length: ny }, () => 'primary' as const)
  } else {
    const ss = selected(run, spec.series)
    const steps = Math.max(0, ...ss.map((s) => s.y.length))
    columns = Array.from({ length: steps }, (_, k) => ss.map((s) => s.y[Math.min(k, s.y.length - 1)]))
    roles = ss.map((s) => s.role)
  }
  if (spec.share) {
    columns = columns.map((col) => {
      const sum = col.reduce((a, v) => a + (Number.isFinite(v) ? v : 0), 0)
      return col.map((v) => (sum > 0 ? v / sum : 0))
    })
  }
  return { count: roles.length, columns, roles }
}

/** The step a plot over steps shows: the timeline's, or the last. */
function stepOf(view: PlotView, steps: number): number {
  return Math.max(0, Math.min(steps - 1, view.steps ?? steps - 1))
}

const isTime = (spec: PlotSpec) => spec.type === 'timeSeriesDiscrete' || spec.type === 'timeSeriesContinuous'

/**
 * How far down zooming and panning may go on each axis. Time does not run before the start,
 * and a quantity that is never negative (populations, concentrations) needs no room below 0.
 * Everything else stays free.
 */
export function panFloors(spec: PlotSpec, run: Run, d: Domains): { x: number; y: number } {
  if (spec.type === 'bars') return { x: -Infinity, y: 0 }
  const nonneg = (arrays: (ArrayLike<number> | undefined)[]) =>
    arrays.length > 0 &&
    arrays.every((a) => {
      if (!a) return false
      for (let i = 0; i < a.length; i++) if (a[i] < 0) return false
      return true
    })
  const floor = (lo: number, ok: boolean) => (ok ? Math.min(lo, 0) : -Infinity)
  const log = spec.yScale === 'log'
  if (isTime(spec)) {
    const ss = selected(run, spec.series).filter((s) => s.role !== 'annotation')
    return { x: d.x[0], y: log ? -Infinity : floor(d.y[0], nonneg(ss.map((s) => s.y))) }
  }
  if (spec.type === 'phasePlane') {
    return {
      x: floor(d.x[0], nonneg([seriesById(run, spec.xSeries)?.y])),
      y: floor(d.y[0], nonneg([seriesById(run, spec.ySeries)?.y])),
    }
  }
  return { x: -Infinity, y: -Infinity }
}

/** Where the model's own span ends on a plot over time (to mark it when zoomed beyond). */
export function timeEnd(spec: PlotSpec, run: Run): number | null {
  if (!isTime(spec)) return null
  let end = -Infinity
  for (const s of selected(run, spec.series)) if (s.x.length && s.role !== 'reference') end = Math.max(end, s.x[s.x.length - 1])
  return Number.isFinite(end) ? end : null
}

function polyline(s: Surface, frame: Frame, xs: ArrayLike<number>, ys: ArrayLike<number>, count = xs.length) {
  let pen = false
  // A sampled curve that leaves the plot far above and comes back far below within one step
  // went through a pole (1/x at 0): no line across it. Two-point lines are left alone.
  const h = frame.plot.h
  const dense = count > 20
  let last = 0
  for (let i = 0; i < count; i++) {
    const X = frame.xScale(xs[i])
    const Y = frame.yScale(ys[i])
    if (!Number.isFinite(X) || !Number.isFinite(Y)) {
      pen = false
      continue
    }
    if (pen && dense && ((last < -h && Y > 2 * h) || (last > 2 * h && Y < -h))) pen = false
    last = Y
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
  if (s.kind === 'discrete' && view.steps !== undefined) return Math.min(s.x.length, view.steps + 1)
  // over continuous time: everything up to the time shown (points of an approximation, too)
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
/**
 * Small arrowheads along a trajectory in the direction of time, evenly spaced on screen
 * (about every 150 px, at most 6), so a phase portrait shows which way it runs.
 */
function trajectoryArrows(s: Surface, frame: Frame, xs: ArrayLike<number>, ys: ArrayLike<number>, count: number, role: Series['role']) {
  const SPACING = 150
  let next = SPACING * 0.45
  let walked = 0
  let drawn = 0
  let [px, py] = [frame.xScale(xs[0]), frame.yScale(ys[0])]
  s.begin({ role, dash: [] })
  for (let i = 1; i < count && drawn < 6; i++) {
    const [qx, qy] = [frame.xScale(xs[i]), frame.yScale(ys[i])]
    if (!Number.isFinite(qx) || !Number.isFinite(qy) || !Number.isFinite(px) || !Number.isFinite(py)) {
      ;[px, py] = [qx, qy]
      continue
    }
    const d = Math.hypot(qx - px, qy - py)
    // only where the point is in view: arrows outside would float over the axes
    const inside = qx >= 0 && qx <= frame.plot.w && qy >= 0 && qy <= frame.plot.h
    if (d > 0 && walked + d >= next && inside) {
      const [ux, uy] = [(qx - px) / d, (qy - py) / d]
      s.polygon(Float64Array.of(qx + ux * 5, qy + uy * 5, qx - ux * 4 - uy * 4, qy - uy * 4 + ux * 4, qx - ux * 4 + uy * 4, qy - uy * 4 - ux * 4))
      drawn++
      next += SPACING
    }
    walked += d
    ;[px, py] = [qx, qy]
  }
  s.end()
}

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
  s.begin({ role: series.role, ...(series.fill || series.arrow ? { dash: [], width: series.fill ? 1.25 : 2 } : {}), ...(series.dash ? { dash: series.dash } : {}) })
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
/** How strongly a held state (vergleichen) is drawn under the current one. */
export const GHOST_FADE = 0.28
const base = (view: PlotView) => (view.ghost ? GHOST_FADE : 1)
/** Series other than the one pointed at in the legend step back — on top of the ghost's fade. */
const dim = (series: Series, view: PlotView) => base(view) * (view.focus && view.focus !== series.id ? 0.15 : 1)

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
    { id: '_null1', label: name(spec.xLabel, 1), name: 'Nullkline', kind: 'continuous', x: empty, y: empty, role: 'tertiary', dash: [] },
    { id: '_null2', label: name(spec.yLabel, 2), name: 'Nullkline', kind: 'continuous', x: empty, y: empty, role: 'secondary', dash: [] },
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
    // solid: the curve is many short pieces, and a dash pattern would restart on each
    s.begin({ role: k === 0 ? 'tertiary' : 'secondary', width: 2, dash: [] })
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
    trajectoryArrows(s, frame, sx.y, sy.y, sx.y.length, 'primary')
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

/** The step a stepped series shows: the timeline's, or its last. */
export function currentStep(series: Series, view: PlotView): number {
  const k = series.stepOf!
  const last = k.length ? k[k.length - 1] : 0
  return view.steps === undefined ? last : Math.min(view.steps, last)
}

/**
 * A series with `stepOf`: earlier steps faint (or hidden), the current one in full and a
 * little stronger, later ones not yet.
 */
function drawStepped(s: Surface, frame: Frame, series: Series, view: PlotView, fade: number) {
  const k = series.stepOf!
  const cur = currentStep(series, view)
  const part = (keep: (step: number) => boolean) => {
    const x: number[] = []
    const y: number[] = []
    let prev = NaN
    for (let i = 0; i < series.x.length; i++) {
      if (!keep(k[i])) continue
      if (!Number.isNaN(prev) && k[i] !== prev) x.push(NaN), y.push(NaN)
      x.push(series.x[i])
      y.push(series.y[i])
      prev = k[i]
    }
    return { x: Float64Array.from(x), y: Float64Array.from(y) }
  }
  const draw = (p: { x: Float64Array; y: Float64Array }, strong: boolean) => {
    if (!p.x.length) return
    if (series.kind === 'discrete') {
      s.begin({ role: series.role })
      dots(s, frame, p.x, p.y, p.x.length, strong ? 5 : 3.5)
      s.end()
      return
    }
    s.begin({ role: series.role, width: strong ? roleStyles[series.role].width + 0.75 : undefined, ...(series.dash ? { dash: series.dash } : {}) })
    polyline(s, frame, p.x, p.y)
    s.end()
  }
  if ((series.stepMode ?? 'trace') === 'trace') {
    s.fade(fade * 0.35)
    draw(part((step) => step < cur), false)
  }
  s.fade(fade)
  draw(part((step) => step === cur), true)
}

/** Labels of the current step's points, in data coordinates. */
export function stepLabels(spec: PlotSpec, run: Run, view: PlotView): { x: number; y: number; tex: string; role: Series['role'] }[] {
  if (!('series' in spec)) return []
  const out: { x: number; y: number; tex: string; role: Series['role'] }[] = []
  for (const series of shown(run, spec.series, view)) {
    if (!series.labels) continue
    const cur = series.stepOf ? currentStep(series, view) : NaN
    series.labels.forEach((tex, i) => {
      if (!tex || (series.stepOf && series.stepOf[i] !== cur)) return
      out.push({ x: series.x[i], y: series.y[i], tex, role: series.role })
    })
  }
  return out
}

function diagonal(s: Surface, frame: Frame) {
  const [a, b] = frame.xDomain
  s.begin({ role: 'reference' })
  polyline(s, frame, [a, b], [a, b])
  s.end()
}

export function drawPlot(s: Surface, frame: Frame, spec: PlotSpec, run: Run, view: PlotView = {}): void {
  s.fade(base(view))
  switch (spec.type) {
    case 'surface3d':
      return
    case 'bars': {
      const b = barValues(spec, run)
      if (!b.columns.length) return
      const col = b.columns[stepOf(view, b.columns.length)]
      const y0 = frame.yScale(Math.max(frame.yDomain[0], 0))
      const w = Math.max(1, Math.abs(frame.xScale(1) - frame.xScale(0)) * 0.7)
      col.forEach((v, i) => {
        if (!Number.isFinite(v)) return
        const cx = frame.xScale(i + 1)
        const y = frame.yScale(v)
        s.begin({ role: b.roles[i], alpha: 0.85 })
        s.polygon(Float64Array.of(cx - w / 2, y0, cx + w / 2, y0, cx + w / 2, y, cx - w / 2, y))
        s.end()
      })
      return
    }
    case 'heatmap': {
      const g = run.grids?.find((q) => q.id === spec.grid)
      if (!g || !g.x.length || !g.y.length) return
      const [nx, ny] = [g.x.length, g.y.length]
      let [lo, hi] = spec.zRange ?? [Infinity, -Infinity]
      if (!spec.zRange) for (const v of g.z) if (Number.isFinite(v)) (lo = Math.min(lo, v)), (hi = Math.max(hi, v))
      const span = hi > lo ? hi - lo : 1
      // the timeline uncovers the columns
      const shown = view.steps !== undefined ? Math.min(nx, view.steps + 1) : view.time !== undefined ? g.x.filter((x) => x <= view.time!).length : nx
      const values = new Float32Array(nx * ny)
      for (let j = 0; j < ny; j++) {
        // row 0 of the image is the top: the largest y
        const row = ny - 1 - j
        for (let i = 0; i < nx; i++) values[row * nx + i] = i < shown ? Math.max(0, Math.min(1, (g.z[j * nx + i] - lo) / span)) : NaN
      }
      const d = plotDomains(spec, run)
      const [x0, x1] = [frame.xScale(d.x[0]), frame.xScale(d.x[1])]
      const [yTop, yBottom] = [frame.yScale(d.y[1]), frame.yScale(d.y[0])]
      s.raster(x0, yTop, x1 - x0, yBottom - yTop, nx, ny, values)
      return
    }
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
        drawDiscrete(s, frame, series, count, (view.connect ?? true) && (spec.connect ?? series.connect ?? true))
        if (timed(view) && series.kind === 'discrete' && count <= frame.plot.w) head(s, frame, series.x[count - 1], series.y[count - 1], series.role)
      }
      s.fade(base(view))
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
        if (series.stepOf) {
          drawStepped(s, frame, series, view, dim(series, view))
          continue
        }
        if (series.kind === 'discrete') {
          drawDiscrete(s, frame, series, visible(series, view), (view.connect ?? true) && (series.connect ?? true), series.role !== 'data')
          continue
        }
        // reference lines and the faint family stay whole; the solution itself runs with the timeline
        const cut = spec.type === 'timeSeriesContinuous' && series.role !== 'reference' && series.role !== 'ghost'
        const count = cut ? visible(series, view) : series.x.length
        drawLine(s, frame, series, count)
        if (cut && view.time !== undefined) head(s, frame, series.x[count - 1], series.y[count - 1], series.role)
      }
      s.fade(base(view))
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
        if (!view.ghost) trajectoryArrows(s, frame, sx.y, sy.y, count, 'primary')
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
