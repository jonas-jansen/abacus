/**
 * The top layer's transient geometry: marks (what a readout refers to) and the probe (the
 * step or time the pointer is over, shown in every figure at once). Pure: returns SVG nodes
 * in figure coordinates plus anchors for HTML tooltips; the UI decides when to show them.
 */

import { formatNumber, type Frame, type Mark, type MarkSpace, type Run, type Series } from '@abacus/applet-core'
import { seriesById, shown, visible, type PlotSpec, type PlotView } from './plots'
import type { SvgNode } from './svg'

export function markSpace(spec: PlotSpec): MarkSpace {
  switch (spec.type) {
    case 'timeSeriesDiscrete':
    case 'timeSeriesContinuous':
    case 'heatmap':
      return 'time'
    case 'bars':
      return 'map'
    case 'cobweb':
    case 'functionGraph':
      return 'map'
    case 'phasePlane':
    case 'scatter':
    case 'surface3d':
      return 'phase'
  }
}

const inside = (v: number, [a, b]: readonly [number, number]) => v >= Math.min(a, b) && v <= Math.max(a, b)

/** The segment of the line through (x, y) with `slope` that lies in the plot, in data units. */
function clipLine(frame: Frame, x: number, y: number, slope: number): [number, number, number, number] | null {
  const [x0, x1] = frame.xDomain
  const [y0, y1] = frame.yDomain
  if (!Number.isFinite(slope)) return inside(x, frame.xDomain) ? [x, y0, x, y1] : null
  const pts: [number, number][] = []
  const at = (xx: number) => y + slope * (xx - x)
  for (const xx of [x0, x1]) if (inside(at(xx), frame.yDomain)) pts.push([xx, at(xx)])
  if (slope !== 0) {
    for (const yy of [y0, y1]) {
      const xx = x + (yy - y) / slope
      if (inside(xx, frame.xDomain)) pts.push([xx, yy])
    }
  }
  if (pts.length < 2) return null
  pts.sort((p, q) => p[0] - q[0])
  const [a, b] = [pts[0], pts[pts.length - 1]]
  return [a[0], a[1], b[0], b[1]]
}

/** SVG nodes that highlight `marks` in this plot; marks from another plane are skipped. */
export function markNodes(frame: Frame, spec: PlotSpec, marks: readonly Mark[]): SvgNode[] {
  const space = markSpace(spec)
  const { plot } = frame
  const X = (v: number) => plot.x + frame.xScale(v)
  const Y = (v: number) => plot.y + frame.yScale(v)
  const left = plot.x
  const right = plot.x + plot.w
  const top = plot.y
  const bottom = plot.y + plot.h
  const out: SvgNode[] = []
  const line = (x1: number, y1: number, x2: number, y2: number, cls = 'ab-mark-line'): void => {
    out.push({ tag: 'line', attrs: { x1, y1, x2, y2, class: cls } })
  }
  const dot = (x: number, y: number) => {
    out.push({ tag: 'circle', attrs: { cx: x, cy: y, r: 9, class: 'ab-mark-halo' } })
    out.push({ tag: 'circle', attrs: { cx: x, cy: y, r: 4.5, class: 'ab-mark-dot' } })
  }
  // Dashed guides from a point to both axes, so its coordinates can be read off.
  const guides = (x: number, y: number) => {
    line(x, y, x, bottom, 'ab-mark-guide')
    line(x, y, left, y, 'ab-mark-guide')
  }

  for (const m of marks) {
    switch (m.kind) {
      case 'value':
        if (space === 'time' && inside(m.v, frame.yDomain)) line(left, Y(m.v), right, Y(m.v))
        if (space === 'map' && inside(m.v, frame.xDomain) && inside(m.v, frame.yDomain)) {
          guides(X(m.v), Y(m.v))
          dot(X(m.v), Y(m.v))
        }
        break
      case 'time':
        if (space === 'time' && inside(m.t, frame.xDomain)) line(X(m.t), top, X(m.t), bottom)
        break
      case 'point':
        if (m.in === space && inside(m.x, frame.xDomain) && inside(m.y, frame.yDomain)) {
          guides(X(m.x), Y(m.y))
          dot(X(m.x), Y(m.y))
        }
        break
      case 'line': {
        if (m.in !== space) break
        const seg = clipLine(frame, m.x, m.y, m.slope)
        if (seg) line(X(seg[0]), Y(seg[1]), X(seg[2]), Y(seg[3]))
        if (inside(m.x, frame.xDomain) && inside(m.y, frame.yDomain)) dot(X(m.x), Y(m.y))
        break
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------
// Probe

export interface ProbeRow {
  /** TeX, e.g. `y_{12}` */
  tex: string
  value: string
}

export interface Probe {
  nodes: SvgNode[]
  /** Where a tooltip should point, in figure coordinates; null if nothing to show. */
  anchor: { x: number; y: number } | null
  rows: ProbeRow[]
}

const EMPTY: Probe = { nodes: [], anchor: null, rows: [] }

/** Index of the sample nearest to t in an increasing array. */
function nearest(xs: ArrayLike<number>, t: number, count = xs.length): number {
  let lo = 0
  let hi = count - 1
  if (hi < 0) return -1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (xs[mid] < t) lo = mid
    else hi = mid
  }
  return Math.abs(xs[lo] - t) <= Math.abs(xs[hi] - t) ? lo : hi
}

/** Linear interpolation of a continuous series at t (NaN outside). */
function valueAt(s: Series, t: number): number {
  const n = s.x.length
  if (n === 0 || t < s.x[0] || t > s.x[n - 1]) return NaN
  const i = nearest(s.x, t)
  const j = s.x[i] <= t ? Math.min(i + 1, n - 1) : Math.max(i - 1, 0)
  if (i === j || s.x[i] === s.x[j]) return s.y[i]
  return s.y[i] + ((s.y[j] - s.y[i]) * (t - s.x[i])) / (s.x[j] - s.x[i])
}

/** `x_n` at a concrete n: `x_{12}`. Labels without a trailing `_n` are returned unchanged. */
export const atIndex = (label: string, n: number) => (/_n$/.test(label) ? label.replace(/_n$/, `_{${n}}`) : label)

const num = (v: number) => formatNumber(v, 4)
const tnum = (v: number) => formatNumber(v, 3)

/**
 * What the probe at time/index `t` looks like in this plot. Discrete series snap to the
 * nearest visible step; continuous series are interpolated.
 */
export function probeNodes(frame: Frame, spec: PlotSpec, run: Run, view: PlotView, t: number): Probe {
  const { plot } = frame
  const X = (v: number) => plot.x + frame.xScale(v)
  const Y = (v: number) => plot.y + frame.yScale(v)
  const nodes: SvgNode[] = []
  const rows: ProbeRow[] = []
  let anchor: Probe['anchor'] = null
  const ok = (x: number, y: number) => Number.isFinite(x) && Number.isFinite(y) && inside(x, frame.xDomain) && inside(y, frame.yDomain)
  const dot = (x: number, y: number, role: Series['role']) => {
    nodes.push({ tag: 'circle', attrs: { cx: X(x), cy: Y(y), r: 5.5, class: 'ab-probe-dot', style: `--c: var(--abacus-${role})` } })
  }

  switch (spec.type) {
    case 'scatter':
    case 'surface3d':
    case 'bars':
      return EMPTY
    case 'heatmap': {
      // the column pointed at, lined up with the other plots over time
      const at = Math.round(t)
      if (!inside(at, frame.xDomain)) return EMPTY
      return { nodes: [{ tag: 'line', attrs: { x1: X(at), y1: plot.y, x2: X(at), y2: plot.y + plot.h, class: 'ab-probe-line' } }], rows: [], anchor: null }
    }
    case 'timeSeriesDiscrete':
    case 'timeSeriesContinuous':
    case 'functionGraph': {
      const series = shown(run, spec.series, view)
      const discrete = series.length > 0 && series.every((s) => s.kind === 'discrete')
      let at = t
      if (discrete) {
        const last = Math.max(...series.map((s) => visible(s, view))) - 1
        at = Math.max(0, Math.min(last, Math.round(t)))
      }
      if (!inside(at, frame.xDomain)) return EMPTY
      nodes.push({ tag: 'line', attrs: { x1: X(at), y1: plot.y, x2: X(at), y2: plot.y + plot.h, class: 'ab-probe-line' } })
      rows.push({ tex: discrete ? 'n' : spec.xLabel ?? 't', value: discrete ? String(at) : tnum(at) })
      for (const s of series) {
        if (s.role === 'reference' || s.role === 'ghost' || s.role === 'annotation') continue
        let x = at
        let y: number
        if (s.kind === 'discrete') {
          // the sample nearest to the pointer, if it is really near (data next to a curve)
          const count = visible(s, view)
          const i = nearest(s.x, at, count)
          const gap = count > 1 ? Math.abs(s.x[Math.min(count - 1, 1)] - s.x[0]) / 2 : Infinity
          if (i < 0 || Math.abs(s.x[i] - at) > gap + 1e-9) continue
          x = s.x[i]
          y = s.y[i]
        } else y = valueAt(s, at)
        if (!Number.isFinite(y)) continue
        rows.push({ tex: s.kind === 'discrete' && discrete ? atIndex(s.label, at) : s.label, value: num(y) })
        if (!ok(x, y)) continue
        dot(x, y, s.role)
        if (!anchor || Y(y) < anchor.y) anchor = { x: X(x), y: Y(y) }
      }
      return { nodes, anchor: anchor ?? { x: X(at), y: plot.y + 12 }, rows }
    }
    case 'cobweb': {
      const orbit = seriesById(run, spec.orbit)
      if (!orbit) return EMPTY
      const last = visible(orbit, view) - 2
      if (last < 0) return EMPTY
      const n = Math.max(0, Math.min(last, Math.round(t)))
      const a = orbit.y[n]
      const b = orbit.y[n + 1]
      if (!ok(a, b)) return EMPTY
      // The step n → n+1: up (or down) to the graph, across to the diagonal.
      nodes.push({
        tag: 'path',
        attrs: { d: `M${X(a)} ${Y(a)}V${Y(b)}H${X(b)}`, class: 'ab-probe-step' },
      })
      dot(a, b, 'secondary')
      rows.push({ tex: atIndex(orbit.label, n), value: num(a) }, { tex: atIndex(orbit.label, n + 1), value: num(b) })
      return { nodes, anchor: { x: X(a), y: Y(b) }, rows }
    }
    case 'phasePlane': {
      const sx = seriesById(run, spec.xSeries)
      const sy = seriesById(run, spec.ySeries)
      if (!sx || !sy) return EMPTY
      const count = visible(sx, view)
      const i = nearest(sx.x, t, count)
      if (i < 0) return EMPTY
      const x = sx.y[i]
      const y = sy.y[i]
      if (!ok(x, y)) return EMPTY
      dot(x, y, 'primary')
      const plain = (l: string) => l.replace(/\(t\)$/, '')
      rows.push(
        sx.kind === 'discrete' ? { tex: 'n', value: String(i) } : { tex: 't', value: tnum(sx.x[i]) },
        { tex: plain(sx.label), value: num(x) },
        { tex: plain(sy.label), value: num(y) },
      )
      return { nodes, anchor: { x: X(x), y: Y(y) }, rows }
    }
  }
}

/**
 * The time/index the pointer at plot coordinates (px, py) refers to, or null. Time series
 * read it off the x axis; cobwebs and phase planes pick the nearest point of the orbit.
 */
export function probeFromPointer(frame: Frame, spec: PlotSpec, run: Run, view: PlotView, px: number, py: number): number | null {
  const reach = 36
  switch (spec.type) {
    case 'scatter':
    case 'surface3d':
    case 'bars':
      return null
    case 'heatmap':
    case 'timeSeriesDiscrete':
    case 'timeSeriesContinuous':
    case 'functionGraph':
      return frame.xInvert(px)
    case 'cobweb': {
      const orbit = seriesById(run, spec.orbit)
      if (!orbit) return null
      const last = visible(orbit, view) - 2
      let best: number | null = null
      let bestD = reach * reach
      for (let n = Math.max(0, last - 4000); n <= last; n++) {
        const dx = frame.xScale(orbit.y[n]) - px
        const dy = frame.yScale(orbit.y[n + 1]) - py
        const d = dx * dx + dy * dy
        // later steps win ties: they are drawn on top
        if (d <= bestD) {
          bestD = d
          best = n
        }
      }
      return best
    }
    case 'phasePlane': {
      const sx = seriesById(run, spec.xSeries)
      const sy = seriesById(run, spec.ySeries)
      if (!sx || !sy) return null
      const count = visible(sx, view)
      const stride = Math.max(1, Math.floor(count / 5000))
      let best: number | null = null
      let bestD = reach * reach
      for (let i = 0; i < count; i += stride) {
        const dx = frame.xScale(sx.y[i]) - px
        const dy = frame.yScale(sy.y[i]) - py
        const d = dx * dx + dy * dy
        if (d < bestD) {
          bestD = d
          best = sx.x[i]
        }
      }
      return best
    }
  }
}
