import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { clamp, formatNumber, makeFrame, MAX_ZOOM_OUT, type Detail, type Frame, type Mark, type Params, type Point, type Run, type Series } from '@abacus/applet-core'
import {
  axesNode,
  CanvasSurface,
  drawBahn,
  nullclineSeries,
  colorVar,
  drawPlot,
  fallbackColors,
  isSquare,
  markNodes,
  panFloors,
  plotDomains,
  timeEnd,
  probeFromPointer,
  probeNodes,
  roleStyles,
  SvgPathSurface,
  type Domain,
  type PlotSpec,
  type PlotView,
  type ProbeRow,
} from '@abacus/applet-plot'
import { handlesOf, type DragHandle, type PlotEntry } from './define'
import { renderSvg } from './svgReact'
import { MathLabel } from './MathLabel'
import { TeX } from './TeX'

/** The hint over a zoomable plot (markup of tip.ts: keys | what they do). */
const ZOOM_TIP = '{Mod} + {Rad} | zoomen\n{Finger} | zoomen mit zwei Fingern\n{Shift} + {Ziehen} | verschieben'

/** Width assumed for the server render; the client re-lays out after measuring. */
const SSR_WIDTH = 640
const MIN_HEIGHT = 240
const MAX_SQUARE = 520
const MAX_HEIGHT = 520
const MAX_DPR = 2

interface FigureProps<P extends Params> {
  entry: PlotEntry<P>
  params: P
  run: Run
  view: PlotView
  onParams: (patch: Record<string, unknown>) => void
  /** What the readout under the pointer refers to. */
  marks?: readonly Mark[] | null
  /** The step or time under the pointer, in any figure of this applet. */
  probe?: number | null
  onProbe?: (t: number | null) => void
  /** TeX symbol of a parameter, for handle tooltips. */
  texOf?: (param: string) => string | undefined
  /** A parameter whose control is hovered: its handles draw attention to themselves. */
  hotParam?: string | null
  /** The parameter whose handle is hovered or dragged (null when none). */
  onHandle?: (param: string | null) => void
  /** Two figures side by side: same height, so their axes line up. */
  pair?: boolean
  /** Legend: switch a series off/on everywhere, or point at it. */
  onToggleSeries?: (id: string) => void
  onFocusSeries?: (id: string | null) => void
  /** A held state to compare with: drawn faintly behind the current one. */
  /** The held state; `detail` gives its run for a zoomed window, like `onDetail` for the current one. */
  vergleich?: { run: Run; text: string; detail?: (d: Detail) => Run | null } | null
  onVergleichLoesen?: () => void
  /** Offer to hold the current state for comparison (shown on one figure only). */
  onVergleichen?: () => void
  /** Phase portrait: further trajectories, and what a click on empty space does. */
  bahnen?: readonly Run[]
  onBahn?: (start: [number, number]) => void
  onBahnenLoeschen?: () => void
  /** Recompute the model in more detail for a zoomed window (null: nothing to add). */
  onDetail?: (d: Detail) => Run | null
}

function resolveSpec<P extends Params>(entry: PlotEntry<P>, p: P): PlotSpec {
  const r = (d: PlotEntry<P>['x']): Domain | undefined => (typeof d === 'function' ? d(p) : d)
  return { ...entry, x: r(entry.x), y: r(entry.y) } as PlotSpec
}

/**
 * The layer sandwich (§5.2): SVG axes · canvas data · SVG annotations and handles.
 * The canvas is sized to the data rectangle exactly, so its coordinates are plot-area
 * coordinates and clipping at the axes is free. Marks and the probe live in the top layer,
 * so pointing at things never redraws the data.
 */
export function Figure<P extends Params>({
  entry,
  params,
  run,
  view,
  onParams,
  marks,
  probe = null,
  onProbe,
  texOf,
  hotParam,
  onHandle,
  pair,
  onToggleSeries,
  onFocusSeries,
  vergleich,
  onVergleichLoesen,
  onVergleichen,
  bahnen,
  onBahn,
  onBahnenLoeschen,
  onDetail,
}: FigureProps<P>) {
  const outer = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(SSR_WIDTH)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
    const el = outer.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width)
      if (w > 0) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const [logY, setLogY] = useState(entry.yScale === 'log')
  const spec = useMemo(() => ({ ...resolveSpec(entry, params), yScale: logY ? 'log' : 'linear' }) as PlotSpec, [entry, params, logY])
  const square = isSquare(spec)
  const figW = square ? Math.min(width, MAX_SQUARE) : width
  // side by side, every figure is as high as it is wide, so both x axes sit at one height
  const aspect = spec.aspect ?? (square || pair ? 1 : width < 640 ? 4 / 3 : 16 / 10)
  const figH = Math.min(square ? MAX_SQUARE : MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(figW / aspect)))

  // While a handle is dragged the axes hold still: an axis that rescales under the pointer
  // would make the handle run away. They catch up when the handle is let go.
  const frozen = useRef<ReturnType<typeof plotDomains> | null>(null)
  const [dragging, setDragging] = useState(false)
  // Zoomed or panned: the student's own window, until reset.
  const [zoom, setZoom] = useState<{ x: readonly [number, number]; y: readonly [number, number] } | null>(null)
  useEffect(() => setZoom(null), [logY])
  // Zoomed in: once the window has settled, the model is asked for more detail in it —
  // curves sampled in the window, diagrams recomputed for it — and that is what is drawn.
  const [settled, setSettled] = useState(zoom)
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(zoom), 120)
    return () => window.clearTimeout(id)
  }, [zoom])
  const full = useMemo(() => plotDomains(spec, run), [spec, run])
  const magnification = (z: { x: readonly [number, number]; y: readonly [number, number] }) => {
    const ly = (v: number) => (spec.yScale === 'log' ? Math.log10(Math.max(v, 1e-300)) : v)
    const mx = (full.x[1] - full.x[0]) / Math.max(1e-300, z.x[1] - z.x[0])
    const my = (ly(full.y[1]) - ly(full.y[0])) / Math.max(1e-300, ly(z.y[1]) - ly(z.y[0]))
    return Math.max(1, mx, my)
  }
  const detailWanted = useMemo((): Detail | null => {
    if (!settled) return null
    // a phase plane's x axis is a state, not the model's variable: only the magnification counts
    const time = spec.type === 'timeSeriesDiscrete' || spec.type === 'timeSeriesContinuous'
    return { x: spec.type === 'phasePlane' ? undefined : settled.x, time: time ? settled.x : undefined, y: settled.y, zoom: magnification(settled) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, spec.type, full])
  const detailRun = useMemo(() => (detailWanted && onDetail ? onDetail(detailWanted) : null), [detailWanted, onDetail])
  const drawn = detailRun ?? run
  // the held state follows the zoom too
  const vergleichDetail = vergleich?.detail
  const ghostRun = useMemo(() => (detailWanted && vergleichDetail ? vergleichDetail(detailWanted) : null), [detailWanted, vergleichDetail])
  const ghost = vergleich ? (ghostRun ?? vergleich.run) : null

  const frame = useMemo(() => {
    const auto = dragging && frozen.current ? frozen.current : plotDomains(spec, run)
    const d = zoom ? { ...auto, x: zoom.x, y: zoom.y } : auto
    if (!dragging) frozen.current = d
    return makeFrame({ width: figW, height: figH, x: d.x, y: d.y, xInteger: d.xInteger, xLabel: spec.xLabel, yLabel: spec.yLabel, yLog: spec.yScale === 'log' })
  }, [spec, run, figW, figH, dragging, zoom])

  // Canvas data layer, redrawn on the next animation frame.
  useEffect(() => {
    if (!hydrated) return
    const id = requestAnimationFrame(() => {
      const cv = canvas.current
      const ctx = cv?.getContext('2d')
      if (!cv || !ctx) return
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1)
      cv.width = Math.round(frame.plot.w * dpr)
      cv.height = Math.round(frame.plot.h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, frame.plot.w, frame.plot.h)
      const css = getComputedStyle(cv)
      const color = (role: keyof typeof fallbackColors) => css.getPropertyValue(colorVar(role)).trim() || fallbackColors[role]
      const surface = new CanvasSurface(ctx, color)
      if (vergleich) {
        // the held state first, faint and complete (no timeline cut), then the current one
        drawPlot(surface, frame, spec, ghost ?? vergleich.run, { hidden: view.hidden, ghost: true })
        surface.fade(1)
      }
      for (const b of bahnen ?? []) drawBahn(surface, frame, spec, b)
      drawPlot(surface, frame, spec, drawn, view)
    })
    return () => cancelAnimationFrame(id)
  }, [hydrated, frame, spec, drawn, view, vergleich, ghost, bahnen])

  // SSR first paint: the same geometry through the SVG emitter.
  const ssrNodes = useMemo(() => {
    if (hydrated) return null
    const s = new SvgPathSurface()
    drawPlot(s, frame, spec, run, view)
    return s.nodes
  }, [hydrated, frame, spec, run, view])

  const markGeom = useMemo(() => (marks?.length ? markNodes(frame, spec, marks) : []), [frame, spec, marks])
  // the probe reads what is drawn — zoomed out that includes the continuation past the end
  const probeGeom = useMemo(() => (probe === null ? null : probeNodes(frame, spec, drawn, view, probe)), [frame, spec, drawn, view, probe])

  // The figure under the pointer shows the tooltip; the others only show where the step is.
  const [source, setSource] = useState(false)
  const [active, setActive] = useState<{ i: number; state: 'hover' | 'drag' } | null>(null)
  const handleState = active?.state ?? null
  const handles = handlesOf(entry)
  const setHandle = (i: number, state: 'hover' | 'drag' | null) => {
    setActive(state ? { i, state } : null)
    setDragging(state === 'drag')
    onHandle?.(state ? handles[i].param : null)
  }

  // Zoomed beyond the model's span: the continuation is drawn behind a veil, from the end on.
  const end = zoom && detailRun ? timeEnd(spec, run) : null
  const spanEnd = end !== null && end > frame.xDomain[0] && end < frame.xDomain[1] ? end : null
  const X = (v: number) => frame.plot.x + frame.xScale(v)

  const legend = legendEntries(spec, run)
  const { plot } = frame
  const layer = { position: 'absolute', left: plot.x, top: plot.y, width: plot.w, height: plot.h } as const

  const pointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!onProbe) return
    const r = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - r.left - plot.x
    const py = e.clientY - r.top - plot.y
    const off = px < -6 || py < -6 || px > plot.w + 6 || py > plot.h + 6
    const t = handleState === 'drag' || off ? null : probeFromPointer(frame, spec, drawn, view, px, py)
    setSource(t !== null)
    onProbe(t)
  }
  const leave = () => {
    setSource(false)
    onProbe?.(null)
  }
  // Zoom and pan. The y axis may be logarithmic: then the window moves in log₁₀.
  const zoomable = spec.type !== 'surface3d'
  const window_ = () => ({ x: frame.xDomain, y: frame.yDomain })
  const yT = (v: number) => (frame.yLog ? Math.log10(v) : v)
  const yTi = (u: number) => (frame.yLog ? 10 ** u : u)
  const MAX_ZOOM = 1e6
  type Win = { x: readonly [number, number]; y: readonly [number, number] }
  // no window before the start of time or below 0 for what is never negative: pushed back up
  const floors = useMemo(() => panFloors(spec, run, full), [spec, run, full])
  const floored = (z: Win): Win => {
    const fit = (r: readonly [number, number], lo: number) => (r[0] >= lo ? r : ([lo, lo + r[1] - r[0]] as const))
    return { x: fit(z.x, floors.x), y: frame.yLog ? z.y : fit(z.y, floors.y) }
  }
  const setZoomLimited = (z: Win) => {
    // no deeper than a million-fold: beyond that, double precision and the samples run out;
    // and no further out than MAX_ZOOM_OUT times the whole picture
    const ly = (v: number) => (frame.yLog ? Math.log10(Math.max(v, 1e-300)) : v)
    const out = Math.max((z.x[1] - z.x[0]) / (full.x[1] - full.x[0]), (ly(z.y[1]) - ly(z.y[0])) / (ly(full.y[1]) - ly(full.y[0])))
    if (magnification(z) <= MAX_ZOOM && !(out > MAX_ZOOM_OUT)) setZoom(floored(z))
  }
  const zoomAt = (px: number, py: number, k: number, kx = k) => {
    const { x, y } = window_()
    const cx = frame.xInvert(px)
    const cy = yT(frame.yInvert(py))
    const [ya, yb] = [yT(y[0]), yT(y[1])]
    setZoomLimited({ x: [cx - (cx - x[0]) * kx, cx + (x[1] - cx) * kx], y: [yTi(cy - (cy - ya) * k), yTi(cy + (yb - cy) * k)] })
  }
  const panBy = (dxPx: number, dyPx: number, from: { x: readonly [number, number]; y: readonly [number, number] }) => {
    const sx = (from.x[1] - from.x[0]) / plot.w
    const [ya, yb] = [yT(from.y[0]), yT(from.y[1])]
    const sy = (yb - ya) / plot.h
    setZoom(floored({ x: [from.x[0] - dxPx * sx, from.x[1] - dxPx * sx], y: [yTi(ya + dyPx * sy), yTi(yb + dyPx * sy)] }))
  }
  const inner = useRef<HTMLDivElement>(null)
  // wheel with Ctrl/⌘ (also a trackpad pinch) zooms; a plain wheel still scrolls the page
  useEffect(() => {
    const el = inner.current
    if (!el || !zoomable) return
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt(e.clientX - r.left - plot.x, e.clientY - r.top - plot.y, Math.exp(Math.max(-0.5, Math.min(0.5, e.deltaY * 0.01))))
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  })
  // Shift + drag pans; two fingers pinch and pan
  const pan = useRef<{ x: number; y: number; from: { x: readonly [number, number]; y: readonly [number, number] } } | null>(null)
  const touches = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d: number; cx: number; cy: number; from: { x: readonly [number, number]; y: readonly [number, number] } } | null>(null)

  // A click (not a drag, not on a handle) on empty plot space starts a new trajectory there.
  const press = useRef<{ x: number; y: number } | null>(null)
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointer(e)
    const onHandle = (e.target as Element).closest('.ab-handle')
    press.current = onBahn && !onHandle ? { x: e.clientX, y: e.clientY } : null
    if (!zoomable || onHandle) return
    if (e.pointerType === 'touch') {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (touches.current.size === 2) {
        const [a, b] = [...touches.current.values()]
        const r = e.currentTarget.getBoundingClientRect()
        pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2 - r.left - plot.x, cy: (a.y + b.y) / 2 - r.top - plot.y, from: window_() }
        press.current = null
      }
    } else if (e.shiftKey) {
      e.preventDefault() // Shift + press would otherwise select text on the page
      e.currentTarget.setPointerCapture(e.pointerId)
      pan.current = { x: e.clientX, y: e.clientY, from: window_() }
      press.current = null
    }
  }
  const moveZoom = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pan.current) {
      panBy(e.clientX - pan.current.x, e.clientY - pan.current.y, pan.current.from)
      return true
    }
    if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const p = pinch.current
      if (p && touches.current.size === 2) {
        const [a, b] = [...touches.current.values()]
        const r = e.currentTarget.getBoundingClientRect()
        const k = p.d / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))
        // zoom about the first centre, then follow the fingers
        const cx = (a.x + b.x) / 2 - r.left - plot.x
        const cy = (a.y + b.y) / 2 - r.top - plot.y
        const f = p.from
        const x0 = frame.xInvert(p.cx)
        setZoomLimited({
          x: [x0 - (x0 - f.x[0]) * k - ((cx - p.cx) * (f.x[1] - f.x[0]) * k) / plot.w, x0 + (f.x[1] - x0) * k - ((cx - p.cx) * (f.x[1] - f.x[0]) * k) / plot.w],
          y: (() => {
            const [ya, yb] = [yT(f.y[0]), yT(f.y[1])]
            const y0 = yT(frame.yInvert(p.cy))
            const shift = ((cy - p.cy) * (yb - ya) * k) / plot.h
            return [yTi(y0 - (y0 - ya) * k + shift), yTi(y0 + (yb - y0) * k + shift)] as const
          })(),
        })
        return true
      }
    }
    return false
  }
  const endZoom = (e: ReactPointerEvent<HTMLDivElement>) => {
    pan.current = null
    touches.current.delete(e.pointerId)
    if (touches.current.size < 2) pinch.current = null
  }
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    endZoom(e)
    const p = press.current
    press.current = null
    if (!p || !onBahn || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 4) return
    const r = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - r.left - plot.x
    const py = e.clientY - r.top - plot.y
    if (px < 0 || py < 0 || px > plot.w || py > plot.h) return
    onBahn([frame.xInvert(px), frame.yInvert(py)])
  }

  const positions = hydrated ? handles.map((h) => handlePosition(h, frame, params)) : []
  let tip: { x: number; y: number; rows: ProbeRow[] } | null = null
  const at = active && positions[active.i]
  if (active && at) {
    const h = handles[active.i]
    const row = (id: string): ProbeRow => {
      const v = params[id]
      const value = Array.isArray(v) ? `(${v.map((c) => formatNumber(c, 3)).join('; ')})` : typeof v === 'number' ? formatNumber(v, 3) : String(v)
      return { tex: texOf?.(id) ?? id, value }
    }
    tip = { x: at[0], y: at[1], rows: [h.param, ...(h.also ?? [])].map(row) }
  } else if (source && probeGeom?.anchor && probeGeom.rows.length) {
    tip = { ...probeGeom.anchor, rows: probeGeom.rows }
  }

  return (
    <figure className="ab-figure" ref={outer} data-spot={markGeom.length > 0 || undefined}>
      <FigureHead
        title={spec.title}
        legend={legend}
        hidden={view.hidden}
        onToggle={onToggleSeries}
        onFocus={onFocusSeries}
        log={entry.logToggle ? { on: logY, set: setLogY, hilfe: entry.logHilfe } : undefined}
        vergleich={vergleich ? { text: vergleich.text, loesen: onVergleichLoesen } : undefined}
        onVergleichen={onVergleichen}
        bahnen={onBahn ? { n: bahnen?.length ?? 0, loeschen: onBahnenLoeschen } : undefined}
        zoomReset={zoom ? () => setZoom(null) : undefined}
      />
      <div
        className="ab-figure-inner"
        role="img"
        aria-label={spec.title ?? [spec.yLabel, spec.xLabel].filter(Boolean).join(' über ')}
        ref={inner}
        onPointerMove={(e) => {
          if (!moveZoom(e)) pointer(e)
        }}
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={endZoom}
        onPointerLeave={leave}
        // in a phase portrait a double click would also add two trajectories; there the pill resets
        onDoubleClick={() => !onBahn && setZoom(null)}
        data-tip={zoomable ? ZOOM_TIP + (onBahn ? '' : '\n{Doppelklick} | zurück zum ganzen Bild') : undefined}
        data-tip-at="pointer"
        style={{ width: figW, height: figH, cursor: onBahn ? 'crosshair' : undefined, touchAction: zoomable ? 'pan-x pan-y' : undefined }}
      >
        <svg width={figW} height={figH} className="ab-layer" aria-hidden="true">
          {renderSvg(axesNode(frame, { x: spec.xLabel, y: spec.yLabel }))}
        </svg>
        {hydrated ? (
          <canvas ref={canvas} className="ab-data" style={{ ...layer, pointerEvents: 'none' }} aria-hidden="true" />
        ) : (
          <svg width={plot.w} height={plot.h} className="ab-data" style={{ ...layer, overflow: 'hidden' }} aria-hidden="true">
            {ssrNodes?.map((n, i) => renderSvg(n, i))}
          </svg>
        )}
        <svg width={figW} height={figH} className="ab-layer ab-top" aria-hidden="true">
          {spanEnd !== null && (
            <g className="ab-span-end">
              <rect x={X(spanEnd)} y={plot.y} width={plot.x + plot.w - X(spanEnd)} height={plot.h} />
              <line x1={X(spanEnd)} y1={plot.y} x2={X(spanEnd)} y2={plot.y + plot.h} />
            </g>
          )}
          {markGeom.map((n, i) => renderSvg(n, i))}
          {probeGeom?.nodes.map((n, i) => renderSvg(n, 1000 + i))}
          {handles.map((h, i) => {
            const pos = positions[i]
            return pos ? (
              <Handle key={i} drag={h} at={pos} frame={frame} params={params} hot={h.param === hotParam} onParams={onParams} onState={(st) => setHandle(i, st)} />
            ) : null
          })}
        </svg>
        {handles.map((h, i) => {
          const pos = positions[i]
          const tex = h.label ?? texOf?.(h.param)
          if (!pos || !tex || active?.i === i) return null
          // the name of what can be dragged, beside it; to the left near the right edge
          const flip = pos[0] > figW - 60
          return (
            <span key={i} className="ab-handle-label" data-flip={flip || undefined} style={{ left: pos[0], top: pos[1] }} aria-hidden="true">
              <TeX tex={tex} />
            </span>
          )
        })}
        {tip && (
          <div className="ab-tip" data-kind={active ? 'handle' : 'probe'} data-below={tip.y < 72 || undefined} style={{ left: clamp(tip.x, 60, figW - 60), top: tip.y }} aria-hidden="true">
            {tip.rows.map((r, i) => (
              <span key={i} className="ab-tip-row">
                <TeX tex={r.tex} />
                <span className="ab-tip-eq">=</span>
                <span className="ab-tip-val">{r.value}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </figure>
  )
}

/** Where a drag handle sits, in figure coordinates; null when it cannot be placed. */
function handlePosition(drag: DragHandle<any>, frame: Frame, params: Params): [number, number] | null {
  let dx: number
  let dy: number
  if (drag.at) {
    const a = drag.at(params)
    if (!a) return null
    ;[dx, dy] = a
  } else {
    const v = params[drag.param]
    if (drag.axis === 'xy') [dx, dy] = v as Point
    else if (drag.axis === 'x') [dx, dy] = [v as number, clamp(0, frame.yDomain[0], frame.yDomain[1])]
    else [dx, dy] = [clamp(0, frame.xDomain[0], frame.xDomain[1]), v as number]
  }
  const cx = frame.plot.x + frame.xScale(dx)
  const cy = frame.plot.y + frame.yScale(dy)
  // a handle outside the plot would be unreachable and float over the axes
  const inside = cx >= frame.plot.x - 1 && cx <= frame.plot.x + frame.plot.w + 1 && cy >= frame.plot.y - 1 && cy <= frame.plot.y + frame.plot.h + 1
  return Number.isFinite(cx) && Number.isFinite(cy) && inside ? [cx, cy] : null
}

/**
 * A draggable handle with a ≥ 44 px hit target. `touch-action: none` sits on the handle
 * only, so a drag that starts anywhere else on the plot still scrolls the page (§6.2).
 * The grab offset is kept, so the handle does not jump under the pointer.
 */
function Handle({
  drag,
  at: [cx, cy],
  frame,
  params,
  hot,
  onParams,
  onState,
}: {
  drag: DragHandle<any>
  at: [number, number]
  frame: Frame
  params: Params
  hot?: boolean
  onParams: (patch: Record<string, unknown>) => void
  onState: (s: 'hover' | 'drag' | null) => void
}) {
  const { plot } = frame
  const grab = useRef<[number, number]>([0, 0])
  const pointer = (e: ReactPointerEvent<SVGGElement>): [number, number] => {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
    return [e.clientX - rect.left, e.clientY - rect.top]
  }
  const move = (e: ReactPointerEvent<SVGGElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    const [px, py] = pointer(e)
    const x = frame.xInvert(px + grab.current[0] - plot.x)
    const y = frame.yInvert(py + grab.current[1] - plot.y)
    if (drag.set) onParams({ ...drag.set(x, y, params) })
    else onParams({ [drag.param]: drag.axis === 'xy' ? [x, y] : drag.axis === 'x' ? x : y })
  }
  const cursor = drag.axis === 'x' ? 'ew-resize' : drag.axis === 'y' ? 'ns-resize' : 'move'

  return (
    <g
      className="ab-handle"
      data-hot={hot || undefined}
      style={{ touchAction: 'none', pointerEvents: 'auto', cursor }}
      onPointerEnter={() => onState('hover')}
      onPointerLeave={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) onState(null)
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        e.preventDefault()
        const [px, py] = pointer(e)
        grab.current = [cx - px, cy - py]
        onState('drag')
      }}
      onPointerMove={move}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId)
        onState(e.pointerType === 'mouse' ? 'hover' : null)
      }}
    >
      <circle cx={cx} cy={cy} r={22} fill="transparent" />
      <circle cx={cx} cy={cy} r={12} className="ab-handle-ring" />
      <circle cx={cx} cy={cy} r={7} className="ab-handle-dot" />
      {drag.axis !== 'xy' && (
        // a hint of the direction it moves in
        <path
          className="ab-handle-arrows"
          d={drag.axis === 'x' ? `M${cx - 17} ${cy}l4 -3.5v7zM${cx + 17} ${cy}l-4 -3.5v7z` : `M${cx} ${cy - 17}l-3.5 4h7zM${cx} ${cy + 17}l-3.5 -4h7z`}
        />
      )}
    </g>
  )
}

const LOG_HILFE =
  'Auf einer logarithmischen Achse bedeuten gleiche Abstände gleiche Faktoren: von 1 bis 0,1 ist es so weit wie von 0,1 bis 0,01. So sind sehr große und sehr kleine Werte zugleich zu sehen. Eine Gerade heißt: der Wert ändert sich in jedem Schritt um denselben Faktor. Null und negative Werte haben auf dieser Achse keinen Platz.'

/**
 * The row above a plot: title, legend and axis switch. Every figure has it, so figures side
 * by side keep their plots at the same height. Legend entries are buttons: pointing at one
 * lets the others step back, a click switches the series off (and on) in every plot.
 */
function FigureHead({
  title,
  legend,
  hidden,
  onToggle,
  onFocus,
  log,
  vergleich,
  onVergleichen,
  bahnen,
  zoomReset,
}: {
  title?: string
  legend: Series[]
  hidden?: ReadonlySet<string>
  onToggle?: (id: string) => void
  onFocus?: (id: string | null) => void
  log?: { on: boolean; set: (on: boolean) => void; hilfe?: string }
  vergleich?: { text: string; loesen?: () => void }
  onVergleichen?: () => void
  bahnen?: { n: number; loeschen?: () => void }
  zoomReset?: () => void
}) {
  const [help, setHelp] = useState(false)
  const helpRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!help) return
    const close = (e: PointerEvent) => {
      if (!helpRef.current?.contains(e.target as Node)) setHelp(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setHelp(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [help])

  return (
    <div className="ab-fighead">
      {title && <span className="ab-figtitle">{title}</span>}
      {onVergleichen && (
        <button type="button" className="ab-pill" onClick={onVergleichen} data-tip="den jetzigen Zustand festhalten – dann etwas ändern und vergleichen">
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <path d="M5.5 2.5h5l-1 4 2.5 2.5h-9L5.5 6.5zM8 9v4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          vergleichen
        </button>
      )}
      {zoomReset && (
        <button type="button" className="ab-pill" onClick={zoomReset} data-tip={bahnen ? 'zurück zum ganzen Bild' : '{Doppelklick} | zurück zum ganzen Bild'}>
          Ausschnitt zurücksetzen
        </button>
      )}
      {bahnen &&
        (bahnen.n > 0 ? (
          <button type="button" className="ab-pill" onClick={bahnen.loeschen} data-tip="die zusätzlichen Bahnen entfernen">
            {bahnen.n === 1 ? '1 Bahn' : `${bahnen.n} Bahnen`} löschen
          </button>
        ) : (
          <span className="ab-fig-hint">klicken: weitere Bahn</span>
        ))}
      {vergleich && (
        <button type="button" className="ab-legend-item ab-legend-ghost" onClick={vergleich.loesen} data-tip="Vergleich lösen">
          <svg width="22" height="10" aria-hidden="true">
            <line x1="1" y1="5" x2="21" y2="5" stroke="var(--ab-muted)" strokeWidth="2.5" strokeLinecap="round" opacity="0.4" />
          </svg>
          <MathLabel text={vergleich.text} />
          <span className="ab-legend-x" aria-hidden="true">
            ×
          </span>
        </button>
      )}
      {(legend.length > 1 || legend.some((s) => s.name)) && (
        <div className="ab-legend" role="group" aria-label="Legende: zeigen oder ausblenden" onPointerLeave={() => onFocus?.(null)}>
          {legend.map((s) => {
            const off = hidden?.has(s.id) ?? false
            return (
              <button
                key={s.id}
                type="button"
                className="ab-legend-item"
                aria-pressed={!off}
                data-tip={off ? 'wieder zeigen' : 'ausblenden'}
                onClick={() => onToggle?.(s.id)}
                onPointerEnter={() => !off && onFocus?.(s.id)}
                onFocus={() => !off && onFocus?.(s.id)}
                onBlur={() => onFocus?.(null)}
              >
                <svg width="22" height="10" aria-hidden="true">
                  {s.fill ? (
                    <rect x="4" y="0.5" width="14" height="9" rx="2" fill={`var(--abacus-${s.role})`} fillOpacity="0.25" stroke={`var(--abacus-${s.role})`} />
                  ) : s.kind === 'discrete' && s.connect === false ? (
                    <circle cx="11" cy="5" r="3.5" fill={`var(--abacus-${s.role})`} />
                  ) : (
                    <line
                      x1="1"
                      y1="5"
                      x2="21"
                      y2="5"
                      stroke={`var(--abacus-${s.role})`}
                      strokeWidth={roleStyles[s.role].width + 0.5}
                      strokeDasharray={roleStyles[s.role].dash.join(' ') || undefined}
                      strokeLinecap="round"
                    />
                  )}
                </svg>
                <TeX tex={s.label} />
                {s.name && <span className="ab-legend-name">{s.name}</span>}
              </button>
            )
          })}
        </div>
      )}
      {log && (
        <div className="ab-axis-switch" ref={helpRef}>
          <div className="ab-seg" role="group" aria-label="y-Achse">
            <button type="button" aria-pressed={!log.on} onClick={() => log.set(false)} data-tip="lineare Achse">
              linear
            </button>
            <button type="button" aria-pressed={log.on} onClick={() => log.set(true)} data-tip="logarithmische Achse">
              log
            </button>
          </div>
          <button type="button" className="ab-help-btn" aria-expanded={help} aria-label="Was ist eine logarithmische Achse?" onClick={() => setHelp(!help)}>
            ?
          </button>
          {help && (
            <div className="ab-help" role="note">
              <strong>Logarithmische Achse</strong>
              <p>{LOG_HILFE}</p>
              {log.hilfe && (
                <p>
                  <MathLabel text={log.hilfe} />
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Series shown in a plot that deserve a legend entry (time series and function graphs). */
function legendEntries(spec: PlotSpec, run: Run) {
  if (spec.type === 'phasePlane') return nullclineSeries(spec)
  if (spec.legend === false || spec.type === 'cobweb' || spec.type === 'surface3d') return []
  const ids = spec.series
  // annotations (brackets, arrows) explain themselves where they are drawn
  return (ids ? run.series.filter((s) => ids.includes(s.id)) : run.series).filter((s) => s.role !== 'annotation')
}
