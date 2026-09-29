import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { clamp, formatNumber, makeFrame, type Frame, type Mark, type Params, type Point, type Run, type Series } from '@abacus/applet-core'
import {
  axesNode,
  CanvasSurface,
  colorVar,
  drawPlot,
  fallbackColors,
  isSquare,
  markNodes,
  plotDomains,
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
  const frame = useMemo(() => {
    const d = dragging && frozen.current ? frozen.current : plotDomains(spec, run)
    if (!dragging) frozen.current = d
    return makeFrame({ width: figW, height: figH, x: d.x, y: d.y, xInteger: d.xInteger, xLabel: spec.xLabel, yLabel: spec.yLabel, yLog: spec.yScale === 'log' })
  }, [spec, run, figW, figH, dragging])

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
      drawPlot(new CanvasSurface(ctx, color), frame, spec, run, view)
    })
    return () => cancelAnimationFrame(id)
  }, [hydrated, frame, spec, run, view])

  // SSR first paint: the same geometry through the SVG emitter.
  const ssrNodes = useMemo(() => {
    if (hydrated) return null
    const s = new SvgPathSurface()
    drawPlot(s, frame, spec, run, view)
    return s.nodes
  }, [hydrated, frame, spec, run, view])

  const markGeom = useMemo(() => (marks?.length ? markNodes(frame, spec, marks) : []), [frame, spec, marks])
  const probeGeom = useMemo(() => (probe === null ? null : probeNodes(frame, spec, run, view, probe)), [frame, spec, run, view, probe])

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

  const legend = legendEntries(spec, run)
  const { plot } = frame
  const layer = { position: 'absolute', left: plot.x, top: plot.y, width: plot.w, height: plot.h } as const

  const pointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!onProbe) return
    const r = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - r.left - plot.x
    const py = e.clientY - r.top - plot.y
    const off = px < -6 || py < -6 || px > plot.w + 6 || py > plot.h + 6
    const t = handleState === 'drag' || off ? null : probeFromPointer(frame, spec, run, view, px, py)
    setSource(t !== null)
    onProbe(t)
  }
  const leave = () => {
    setSource(false)
    onProbe?.(null)
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
      />
      <div
        className="ab-figure-inner"
        style={{ width: figW, height: figH }}
        role="img"
        aria-label={spec.title ?? [spec.yLabel, spec.xLabel].filter(Boolean).join(' über ')}
        onPointerMove={pointer}
        onPointerDown={pointer}
        onPointerLeave={leave}
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
          <div className="ab-tip" data-below={tip.y < 72 || undefined} style={{ left: clamp(tip.x, 60, figW - 60), top: tip.y }} aria-hidden="true">
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
}: {
  title?: string
  legend: Series[]
  hidden?: ReadonlySet<string>
  onToggle?: (id: string) => void
  onFocus?: (id: string | null) => void
  log?: { on: boolean; set: (on: boolean) => void; hilfe?: string }
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
      {legend.length > 1 && (
        <div className="ab-legend" role="group" aria-label="Legende: zeigen oder ausblenden" onPointerLeave={() => onFocus?.(null)}>
          {legend.map((s) => {
            const off = hidden?.has(s.id) ?? false
            return (
              <button
                key={s.id}
                type="button"
                className="ab-legend-item"
                aria-pressed={!off}
                title={off ? 'wieder zeigen' : 'ausblenden'}
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
              </button>
            )
          })}
        </div>
      )}
      {log && (
        <div className="ab-axis-switch" ref={helpRef}>
          <div className="ab-seg" role="group" aria-label="y-Achse">
            <button type="button" aria-pressed={!log.on} onClick={() => log.set(false)} title="lineare Achse">
              linear
            </button>
            <button type="button" aria-pressed={log.on} onClick={() => log.set(true)} title="logarithmische Achse">
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
  if (spec.legend === false || spec.type === 'cobweb' || spec.type === 'phasePlane' || spec.type === 'surface3d') return []
  const ids = spec.series
  // annotations (brackets, arrows) explain themselves where they are drawn
  return (ids ? run.series.filter((s) => ids.includes(s.id)) : run.series).filter((s) => s.role !== 'annotation')
}
