import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AXIS_OVERHANG, clamp, formatNumber, labelWidth, makeFrame, type Detail, type Mark, type Params, type Run, type Series } from '@abacus/applet-core'
import { axesNode, CanvasSurface, drawBahn, colorVar, drawPlot, fallbackColors, isSquare, markNodes, panFloors, selected, stepLabels, plotDomains, timeEnd, probeFromPointer, probeNodes, SvgPathSurface, type Domain, type PlotSpec, type PlotView, type ProbeRow } from '@abacus/applet-plot'
import { handlesOf, type PlotEntry } from './define'
import { renderSvg } from './svgReact'
import { TeX } from './TeX'
import { AxisSwitch, FigureActions, FigureHead, FigureLegend, legendEntries } from './FigureHead'
import { Handle, handlePosition } from './Handle'
import { useZoomPan } from './useZoomPan'
import { magnification as magnificationOf, type Win } from './zoom'

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
  const magnification = (z: Win) => magnificationOf(full, z, spec.yScale === 'log')
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
      const surface = new CanvasSurface(ctx, color, css.getPropertyValue('--ab-bg').trim() || '#ffffff')
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
  const farbskala = useMemo(() => {
    if (spec.type !== 'heatmap') return undefined
    const g = run.grids?.find((q) => q.id === spec.grid)
    if (!g) return undefined
    let [lo, hi] = spec.zRange ?? [Infinity, -Infinity]
    if (!spec.zRange) for (const v of g.z) if (Number.isFinite(v)) (lo = Math.min(lo, v)), (hi = Math.max(hi, v))
    return { label: spec.zLabel ?? g.label, lo, hi }
  }, [spec, run])
  const { plot } = frame
  // The row above the plot, on the line of the y label (its middle is the arrow tip): the
  // lin/log switch ends at the plot's right edge; the plot's actions are centred above the x
  // label at the right arrow tip. Both are placed the same in every plot, title or not.
  const kopfzeile = plot.y - AXIS_OVERHANG
  const nAktionen = (zoom ? 1 : 0) + (bahnen?.length ? 1 : 0)
  const aktionenBreite = nAktionen * 24 + Math.max(0, nAktionen - 1) * 6 + (bahnen?.length ? 12 : 0)
  const xLabelMitte = plot.x + plot.w + AXIS_OVERHANG + 2 + labelWidth(spec.xLabel ?? '', frame.fontSize) / 2
  const aktionenLinks = Math.min(xLabelMitte - aktionenBreite / 2, figW - aktionenBreite)
  // the switch moves left if the actions would reach it
  const switchRechts = Math.max(figW - plot.x - plot.w, nAktionen ? figW - aktionenLinks + 8 : 0)

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
  // Zoom and pan (useZoomPan): no window before the start of time or below 0 for what is
  // never negative.
  const zoomable = spec.type !== 'surface3d'
  const floors = useMemo(() => panFloors(spec, run, full), [spec, run, full])
  const inner = useRef<HTMLDivElement>(null)
  const zoomPan = useZoomPan({ el: inner, frame, full, floors, enabled: zoomable, setZoom })

  // A click (not a drag, not on a handle) on empty plot space starts a new trajectory there.
  const press = useRef<{ x: number; y: number } | null>(null)
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointer(e)
    const onHandle = (e.target as Element).closest('.ab-handle')
    press.current = onBahn && !onHandle ? { x: e.clientX, y: e.clientY } : null
    if (!onHandle && zoomPan.down(e)) press.current = null
  }
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    zoomPan.end(e)
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
  // Constructions that unfold step by step name the points of the current step.
  const pointLabels = stepLabels(spec, drawn, view)
    .map((l) => ({ ...l, x: frame.plot.x + frame.xScale(l.x), y: frame.plot.y + frame.yScale(l.y) }))
    .filter((l) => Number.isFinite(l.x) && Number.isFinite(l.y) && l.x >= frame.plot.x && l.x <= frame.plot.x + frame.plot.w && l.y >= frame.plot.y - 1 && l.y <= frame.plot.y + frame.plot.h + 1)
    .filter((l) => !positions.some((p) => p && Math.hypot(p[0] - l.x, p[1] - l.y) < 8))
    // two labels close together: the left one goes to the left of its point
    .map((l, _, all) => ({ ...l, left: all.some((o) => o !== l && o.x >= l.x && o.x - l.x < 40 && Math.abs(o.y - l.y) < 24) }))

  // Arrows name themselves at the tip, unless a handle (with its own label) sits there.
  const arrowLabels = (() => {
    if (spec.type === 'surface3d') return []
    const out: { id: string; label: string; role: Series['role']; x: number; y: number }[] = []
    for (const s of selected(drawn, 'series' in spec ? spec.series : undefined)) {
      if (!s.arrow || s.role === 'ghost' || !s.label || view.hidden?.has(s.id)) continue
      const k = s.x.length - 1
      const x = frame.plot.x + frame.xScale(s.x[k])
      const y = frame.plot.y + frame.yScale(s.y[k])
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < frame.plot.x || x > frame.plot.x + frame.plot.w || y < frame.plot.y || y > frame.plot.y + frame.plot.h) continue
      if (positions.some((p) => p && Math.hypot(p[0] - x, p[1] - y) < 8)) continue
      out.push({ id: s.id, label: s.label, role: s.role, x, y })
    }
    return out
  })()

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
      <FigureHead title={spec.title} />
      <div
        className="ab-figure-inner"
        role="img"
        aria-label={spec.title ?? [spec.yLabel, spec.xLabel].filter(Boolean).join(' über ')}
        ref={inner}
        onPointerMove={(e) => {
          if (!zoomPan.move(e)) pointer(e)
        }}
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={zoomPan.end}
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
          // the label (about 26 px above the handle) would reach the axis label over the plot
          const below = pos[1] < plot.y + 28
          return (
            <span key={i} className="ab-handle-label" data-flip={flip || undefined} data-below={below || undefined} style={{ left: pos[0], top: pos[1] }} aria-hidden="true">
              <TeX tex={tex} />
            </span>
          )
        })}
        {pointLabels.map((a, i) => (
          <span key={`p${i}`} className="ab-handle-label ab-arrow-label" data-flip={a.left || a.x > figW - 60 || undefined} data-below={a.y < plot.y + 28 || undefined} style={{ left: a.x, top: a.y, color: `var(--abacus-${a.role})` }} aria-hidden="true">
            <TeX tex={a.tex} />
          </span>
        ))}
        {arrowLabels.map((a) => (
          <span key={a.id} className="ab-handle-label ab-arrow-label" data-flip={a.x > figW - 60 || undefined} data-below={a.y < plot.y + 28 || undefined} style={{ left: a.x, top: a.y, color: `var(--abacus-${a.role})` }} aria-hidden="true">
            <TeX tex={a.label} />
          </span>
        ))}
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
        {entry.logToggle && (
          <AxisSwitch log={{ on: logY, set: setLogY, hilfe: entry.logHilfe }} style={{ position: 'absolute', top: kopfzeile - 13, right: switchRechts }} />
        )}
        <FigureActions
          zoomReset={zoom ? () => setZoom(null) : undefined}
          bahnen={onBahn ? { n: bahnen?.length ?? 0, loeschen: onBahnenLoeschen } : undefined}
          style={{ top: kopfzeile - 12, left: aktionenLinks }}
        />
      </div>
      <FigureLegend
        legend={legend}
        hidden={view.hidden}
        onToggle={onToggleSeries}
        onFocus={onFocusSeries}
        vergleich={vergleich ? { text: vergleich.text, loesen: onVergleichLoesen } : undefined}
        farbskala={farbskala}
        hinweis={onBahn && !(bahnen && bahnen.length) ? 'klicken: weitere Bahn' : undefined}
      />
    </figure>
  )
}
