import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AXIS_OVERHANG, clamp, estimateTextWidth, formatNumber, labelWidth, makeFrame, TICK, type Detail, type Mark, type Params, type Range, type Run, type Series } from '@abacus/applet-core'
import { axesNode, CanvasSurface, drawBahn, colorVar, drawPlot, fallbackColors, holdRange, isSquare, overflows, roomy, markNodes, panFloors, selected, stepLabels, plotDomains, timeEnd, probeFromPointer, probeNodes, SvgPathSurface, type Domain, type PlotSpec, type PlotView, type ProbeRow } from '@abacus/applet-plot'
import { handlesOf, type PlotEntry } from './define'
import { renderSvg } from './svgReact'
import { TeX } from './TeX'
import { cssColor, useFarbwechsel } from './cssColor'
import { texNumber } from './formula'
import { useSetting } from './useSetting'
import { localPoint, scaleOf } from './scale'
import { AspectSwitch, AxisSwitch, FigureActions, FigureHead, FigureLegend, legendEntries } from './FigureHead'
import { Handle, handlePosition } from './Handle'
import { useZoomPan } from './useZoomPan'
import { magnification as magnificationOf, type Win } from './zoom'

/** The hint over a zoomable plot (markup of tip.ts: keys | what they do). */
const ZOOM_TIP = '{Mod} + {Rad} | zoomen\n{Finger} | zoomen mit zwei Fingern\n{Shift} + {Ziehen} | verschieben'

/** Width assumed for the server render; the client re-lays out after measuring. */
const SSR_WIDTH = 640
const MIN_HEIGHT = 240
/** Height before the screen is known (server render), and the share of the screen's height a plot may take. */
const SSR_HEIGHT = 520
const SCREEN_SHARE = 0.68
const MAX_HEIGHT = 1100
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
  /** Changes when the axes should fit the data afresh (reset, a scenario). */
  viewEpoch?: number
  /**
   * Plots side by side over the same time axis share their x window: zooming or panning one
   * moves the other (each keeps its own y axis).
   */
  xLink?: { x: Range | null; set: (x: Range | null) => void }
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
  view: viewProp,
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
  viewEpoch,
  xLink,
}: FigureProps<P>) {
  const outer = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(SSR_WIDTH)
  // how high a plot may be: a share of the screen, in the applet's own pixels (lecture mode scales)
  const [maxH, setMaxH] = useState(SSR_HEIGHT)
  const [hydrated, setHydrated] = useState(false)
  // when the page came up: what happens while it loads (the state from the address, the first
  // measurement of the size) is shown at once, not as a glide
  const loadedAt = useRef(0)
  const lastSize = useRef<[number, number] | null>(null)
  // The server draws at a guessed size and the default state; the browser knows better a moment
  // later. Until then the plot is invisible (its space kept), so it never visibly jumps.
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setHydrated(true)
    loadedAt.current = performance.now()
    // shown once the real size is measured and the state from the address applied (two frames)
    let id = requestAnimationFrame(() => (id = requestAnimationFrame(() => setReady(true))))
    const el = outer.current
    if (!el) return () => cancelAnimationFrame(id)
    const measure = () => setMaxH(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round((window.innerHeight / scaleOf(el)) * SCREEN_SHARE))))
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width)
      if (w > 0) setWidth(w)
      measure()
    })
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(id)
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const farbwechsel = useFarbwechsel()
  // setting "Punkte von Folgen verbinden": off draws sequences as points only
  const connect = useSetting('verbinden') !== 'aus'
  const view = useMemo(() => ({ ...viewProp, connect }), [viewProp, connect])
  const [logY, setLogY] = useState(entry.yScale === 'log')
  // phase planes: free axes, or equal units on both ("1:1")
  const [equal, setEqual] = useState(false)
  const spec = useMemo(() => ({ ...resolveSpec(entry, params), yScale: logY ? 'log' : 'linear' }) as PlotSpec, [entry, params, logY])
  const square = isSquare(spec)
  // Every plot fills its box's width. Side by side, every figure is as high as it is wide, so
  // both x axes sit at one height; no plot is higher than a good part of the screen.
  const figW = width
  const aspect = spec.aspect ?? (square || pair ? 1 : width < 640 ? 4 / 3 : 16 / 10)
  const figH = Math.min(maxH, Math.max(MIN_HEIGHT, Math.round(figW / aspect)))

  // While a handle is dragged the axes hold still: an axis that rescales under the pointer
  // would make the handle run away. They catch up when the handle is let go.
  const frozen = useRef<ReturnType<typeof plotDomains> | null>(null)
  const [dragging, setDragging] = useState(false)
  // Zoomed or panned: the student's own window, until reset.
  const [zoom, setZoomState] = useState<Win | null>(null)
  const setZoom = (z: Win | null) => {
    setZoomState(z)
    xLink?.set(z ? z.x : null)
  }
  useEffect(() => setZoom(null), [logY])
  // a linked plot zoomed or panned: take its x window, keep this plot's y
  useEffect(() => {
    if (!xLink) return
    const x = xLink.x
    setZoomState((z) => {
      if (!x) return null
      if (z && z.x[0] === x[0] && z.x[1] === x[1]) return z
      return { x, y: z?.y ?? shown.current?.y ?? full.y }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xLink?.x])
  // Every settled view (zoom or pan, after a short rest) goes on a stack: "zurück" returns to
  // the one before – also from the whole picture back to the last zoom.
  const views = useRef<{ stack: (Win | null)[]; last: Win | null; skip: boolean }>({ stack: [], last: null, skip: false })
  const [, setViewCount] = useState(0)
  useEffect(() => {
    const id = window.setTimeout(() => {
      const v = views.current
      const same = (a: Win | null, b: Win | null) => (a === null || b === null ? a === b : a.x[0] === b.x[0] && a.x[1] === b.x[1] && a.y[0] === b.y[0] && a.y[1] === b.y[1])
      if (same(zoom, v.last)) return
      if (v.skip) v.skip = false
      else v.stack.push(v.last)
      v.last = zoom
      setViewCount(v.stack.length)
    }, 400)
    return () => window.clearTimeout(id)
  }, [zoom])
  useEffect(() => {
    views.current = { stack: [], last: null, skip: false }
    setViewCount(0)
  }, [logY])
  const zoomBack = () => {
    const v = views.current
    if (!v.stack.length) return
    v.skip = true
    setZoom(v.stack.pop() ?? null)
    setViewCount(v.stack.length)
  }
  // Zoomed in: once the window has settled, the model is asked for more detail in it —
  // curves sampled in the window, diagrams recomputed for it — and that is what is drawn.
  const [settled, setSettled] = useState(zoom)
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(zoom), 120)
    return () => window.clearTimeout(id)
  }, [zoom])
  // A square plot (phase plane, complex plane, cobweb) in a wider box: rather than stretch it,
  // show more of the x axis, so a unit is as long as in the square and circles stay round.
  // A range that starts at 0 (a quantity never negative) grows to the right only.
  // Axes computed from the data are held across parameter changes (holdRange): a new start
  // value or rate shows as a different curve, not as a rescaled picture. Axes an applet sets
  // itself, and time or parameter axes (which follow N, T or the range), are not held.
  const held = useRef<{ key: string; x: Range | null; y: Range | null; roomy: boolean; overflow: boolean }>({ key: '', x: null, y: null, roomy: false, overflow: false })
  // setting "Achsen automatisch anpassen": off keeps the scale; a button on the y axis refits
  const autoAxes = useSetting('achsen') !== 'aus'
  const [refit, setRefit] = useState(0)
  const heldKey = `${viewEpoch ?? 0}|${logY}|${refit}|${spec.type}|${equal}`
  const full = useMemo(() => {
    const fit = plotDomains(spec, run)
    const h = held.current
    if (h.key !== heldKey) Object.assign(h, { key: heldKey, x: null, y: null })
    const auto = (v: unknown) => v === undefined || v === 'auto'
    const log = spec.yScale === 'log'
    const holdY = auto(entry.y) && spec.type !== 'heatmap' && spec.type !== 'surface3d'
    const holdX = auto(entry.x) && (spec.type === 'phasePlane' || spec.type === 'cobweb')
    const y = holdY ? holdRange(h.y, fit.y, { log, grow: autoAxes }) : fit.y
    const x = holdX ? holdRange(h.x, fit.x, { grow: autoAxes }) : fit.x
    h.y = holdY ? y : null
    h.x = holdX ? x : null
    h.roomy = (holdY && roomy(y, fit.y, log)) || (holdX && roomy(x, fit.x))
    h.overflow = (holdY && overflows(y, fit.y)) || (holdX && overflows(x, fit.x))
    const d = { ...fit, x, y }
    if (equal && spec.type === 'phasePlane') {
      // one unit as long on both axes: the axis with more room per unit shows more
      let out = d
      for (let pass = 0; pass < 2; pass++) {
        const p = makeFrame({ width: figW, height: figH, x: out.x, y: out.y, xLabel: spec.xLabel, yLabel: spec.yLabel }).plot
        const kx = p.w / (d.x[1] - d.x[0])
        const ky = p.h / (d.y[1] - d.y[0])
        const grow = (r: Range, span: number): [number, number] => (r[0] === 0 ? [0, span] : [(r[0] + r[1]) / 2 - span / 2, (r[0] + r[1]) / 2 + span / 2])
        out = kx > ky ? { ...d, x: grow(d.x, p.w / ky) } : { ...d, y: grow(d.y, p.h / kx) }
      }
      return out
    }
    if (!square || figW <= figH + 1) return d
    const opts = { x: d.x, y: d.y, xInteger: d.xInteger, xLabel: spec.xLabel, yLabel: spec.yLabel, yLog: spec.yScale === 'log' }
    const sq = makeFrame({ ...opts, width: figH, height: figH }).plot
    const now = makeFrame({ ...opts, width: figW, height: figH }).plot
    const k = now.w / now.h / (sq.w / sq.h)
    if (!(k > 1.001)) return d
    const span = (d.x[1] - d.x[0]) * k
    const wide: [number, number] = d.x[0] === 0 ? [0, span] : [(d.x[0] + d.x[1]) / 2 - span / 2, (d.x[0] + d.x[1]) / 2 + span / 2]
    return { ...d, x: wide }
  }, [spec, run, square, figW, figH, heldKey, entry.x, entry.y, autoAxes, equal])
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

  // When the held window has to move or grow, the axes glide there instead of jumping, so the
  // change of scale is seen – and the curve moves with them. Two steps, one after the other:
  // first the scale changes about 0 (or about the window's edge nearest to 0), then the window
  // moves; a step that is not needed is left out.
  const shown = useRef<{ x: Range; y: Range } | null>(null)
  const [tween, setTween] = useState<{ x: Range; y: Range } | null>(null)
  // a layout effect: the first step is set before the new window is ever painted
  useLayoutEffect(() => {
    const from = shown.current
    const to = { x: full.x, y: full.y }
    const close = (a: number, b: number, span: number) => Math.abs(a - b) <= 1e-9 * (1 + span)
    const same = (a: Range, b: Range) => close(a[0], b[0], b[1] - b[0]) && close(a[1], b[1], b[1] - b[0])
    const resized = !!lastSize.current && (lastSize.current[0] !== figW || lastSize.current[1] !== figH)
    lastSize.current = [figW, figH]
    const loading = !loadedAt.current || performance.now() - loadedAt.current < 700
    if (!from || zoom || dragging || resized || loading || (same(from.x, to.x) && same(from.y, to.y)) || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setTween(null)
      return
    }
    const log = spec.yScale === 'log'
    // work in log₁₀ on a log axis, so the steps are even there too
    const enc = (r: Range, lg: boolean): Range => (lg && r[0] > 0 && r[1] > 0 ? [Math.log10(r[0]), Math.log10(r[1])] : r)
    const dec = (r: Range, lg: boolean): Range => (lg ? [10 ** r[0], 10 ** r[1]] : r)
    const plan = (a: Range, b: Range, lg: boolean) => {
      const [f, t] = [enc(a, lg), enc(b, lg)]
      const k = (t[1] - t[0]) / (f[1] - f[0])
      const pivot = lg ? f[0] : Math.min(f[1], Math.max(f[0], 0))
      const mid: Range = [pivot + (f[0] - pivot) * k, pivot + (f[1] - pivot) * k]
      return { f, mid, t, lg, scales: !close(k, 1, 1), moves: !close(mid[0], t[0], t[1] - t[0]) }
    }
    const px = plan(from.x, to.x, false)
    const py = plan(from.y, to.y, log)
    const SCALE = 450
    const MOVE = 400
    const t1 = px.scales || py.scales ? SCALE : 0
    const t2 = px.moves || py.moves ? MOVE : 0
    const ease = (k: number) => 1 - (1 - k) ** 3
    const lerp = (a: Range, b: Range, e: number): Range => [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e]
    const at = (p: ReturnType<typeof plan>, ms: number): Range =>
      dec(ms < t1 ? lerp(p.f, p.mid, ease(ms / t1)) : lerp(p.mid, p.t, t2 ? ease(Math.min(1, (ms - t1) / t2)) : 1), p.lg)
    setTween({ x: at(px, 0), y: at(py, 0) })
    const t0 = performance.now()
    let id = requestAnimationFrame(function step(now) {
      const ms = now - t0
      if (ms >= t1 + t2) return setTween(null)
      setTween({ x: at(px, ms), y: at(py, ms) })
      id = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full.x[0], full.x[1], full.y[0], full.y[1], dragging, figW, figH])

  const frame = useMemo(() => {
    const target = tween && !zoom ? { ...full, ...tween } : full
    const auto = dragging && frozen.current ? frozen.current : target
    const d = zoom ? { ...auto, x: zoom.x, y: zoom.y } : auto
    if (!dragging) frozen.current = d
    return makeFrame({ width: figW, height: figH, x: d.x, y: d.y, xInteger: d.xInteger, xLabel: spec.xLabel, yLabel: spec.yLabel, yLog: spec.yScale === 'log' })
  }, [spec, full, figW, figH, dragging, zoom, tween])
  // what is on screen now: where the next glide starts (after the effect above has read it)
  useEffect(() => {
    if (!zoom) shown.current = { x: frame.xDomain, y: frame.yDomain }
  })

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
      const color = (role: keyof typeof fallbackColors) => cssColor(css, colorVar(role), fallbackColors[role])
      const surface = new CanvasSurface(ctx, color, cssColor(css, '--ab-bg', '#ffffff'))
      if (vergleich) {
        // the held state first, faint and complete (no timeline cut), then the current one
        drawPlot(surface, frame, spec, ghost ?? vergleich.run, { hidden: view.hidden, ghost: true, connect: view.connect })
        surface.fade(1)
      }
      for (const b of bahnen ?? []) drawBahn(surface, frame, spec, b)
      drawPlot(surface, frame, spec, drawn, view)
    })
    return () => cancelAnimationFrame(id)
  }, [hydrated, frame, spec, drawn, view, vergleich, ghost, bahnen, farbwechsel])

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
  // The plot's actions stand on the line of the y label (its middle is the arrow tip), centred
  // above the x label at the right arrow tip.
  const kopfzeile = plot.y - AXIS_OVERHANG
  const showReset = !!zoom || (autoAxes && held.current.roomy)
  const showBack = views.current.stack.length > 0
  const nAktionen = (showReset ? 1 : 0) + (showBack ? 1 : 0) + (bahnen?.length ? 1 : 0)
  const aktionenBreite = nAktionen * 24 + Math.max(0, nAktionen - 1) * 6 + (bahnen?.length ? 12 : 0)
  const xLabelMitte = plot.x + plot.w + AXIS_OVERHANG + 2 + labelWidth(spec.xLabel ?? '', frame.fontSize) / 2
  const aktionenLinks = Math.min(xLabelMitte - aktionenBreite / 2, figW - aktionenBreite)

  const layer = { position: 'absolute', left: plot.x, top: plot.y, width: plot.w, height: plot.h } as const
  const badgeW = frame.yExp ? estimateTextWidth('×10', frame.fontSize) + estimateTextWidth(String(frame.yExp), frame.fontSize * 0.75) + 12 + 6 : 0
  const fitButtonX = plot.x - TICK - 10 - badgeW - 4

  const pointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!onProbe) return
    const [lx, ly] = localPoint(e.currentTarget, e.clientX, e.clientY)
    const px = lx - plot.x
    const py = ly - plot.y
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
    const [lx, ly] = localPoint(e.currentTarget, e.clientX, e.clientY)
    const px = lx - plot.x
    const py = ly - plot.y
    if (px < 0 || py < 0 || px > plot.w || py > plot.h) return
    onBahn([frame.xInvert(px), frame.yInvert(py)])
  }

  const positions = hydrated ? handles.map((h, i) => handlePosition(h, frame, params, active?.i === i && active.state === 'drag')) : []
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

  // Guides: where a parameter acts (a slope triangle for an increment, an arrow for a factor),
  // in figure pixels; left out when their points are out of view.
  type GuideGeom = { id: string; d: string; head?: string; labels: { tex: string; x: number; y: number; side: 'right' | 'left' | 'below' | 'above' }[] }
  const guideGeom: GuideGeom[] = (() => {
    if (!entry.guides || spec.type === 'surface3d') return []
    const P = (v: readonly [number, number]): [number, number] => [plot.x + frame.xScale(v[0]), plot.y + frame.yScale(v[1])]
    const inView = (q: [number, number]) => Number.isFinite(q[0]) && Number.isFinite(q[1]) && q[0] >= plot.x - 1 && q[0] <= plot.x + plot.w + 1 && q[1] >= plot.y - 1 && q[1] <= plot.y + plot.h + 1
    const out: GuideGeom[] = []
    const valueOf = (id: string | undefined) => (id !== undefined && typeof params[id] === 'number' ? texNumber(params[id] as number, 3) : null)
    entry.guides(params).forEach((g, i) => {
      const v = valueOf(g.param)
      const [a, c] = [P(g.from), P(g.to)]
      if (!inView(a) || !inView(c)) return
      if (g.kind === 'rise') {
        const b: [number, number] = [c[0], a[1]]
        if (Math.abs(c[1] - b[1]) < 3 && Math.abs(b[0] - a[0]) < 3) return
        const labels: GuideGeom['labels'] = []
        if (Math.abs(c[1] - b[1]) >= 6) labels.push({ tex: v ? `${g.label} = ${v}` : g.label, x: b[0], y: (b[1] + c[1]) / 2, side: b[0] > plot.x + plot.w - 60 ? 'left' : 'right' })
        if (g.run && Math.abs(b[0] - a[0]) >= 8) labels.push({ tex: g.run, x: (a[0] + b[0]) / 2, y: a[1], side: c[1] < a[1] ? 'below' : 'above' })
        out.push({ id: `g${i}`, d: `M${a[0]} ${a[1]}H${b[0]}V${c[1]}`, labels })
      } else {
        const [dx, dy] = [c[0] - a[0], c[1] - a[1]]
        const len = Math.hypot(dx, dy)
        if (len < 6) return
        // bulge to the right (or up, when the step is flat), away from the y axis numbers
        let [nx, ny] = [-dy / len, dx / len]
        if (nx < 0 || (Math.abs(nx) < 1e-6 && ny > 0)) [nx, ny] = [-nx, -ny]
        const bend = Math.min(60, 0.35 * len + 10)
        const k: [number, number] = [(a[0] + c[0]) / 2 + nx * bend, (a[1] + c[1]) / 2 + ny * bend]
        // the arrowhead along the curve's end tangent, stopping short of the point's dot
        const [tx, ty] = [c[0] - k[0], c[1] - k[1]]
        const tl = Math.hypot(tx, ty) || 1
        const [ux, uy] = [tx / tl, ty / tl]
        const tip: [number, number] = [c[0] - ux * 7, c[1] - uy * 7]
        const head = `M${tip[0] - ux * 7 - uy * 4} ${tip[1] - uy * 7 + ux * 4}L${tip[0]} ${tip[1]}L${tip[0] - ux * 7 + uy * 4} ${tip[1] - uy * 7 - ux * 4}`
        const mid: [number, number] = [0.25 * a[0] + 0.5 * k[0] + 0.25 * tip[0], 0.25 * a[1] + 0.5 * k[1] + 0.25 * tip[1]]
        // beside the arrow; for a short one, clear of the handles' own labels (right of the points)
        const tex = v ? `${g.label}\\quad {\\small ${texOf?.(g.param!) ?? g.param} = ${v}}` : g.label
        out.push({ id: `g${i}`, d: `M${a[0]} ${a[1]}Q${k[0]} ${k[1]} ${tip[0]} ${tip[1]}`, head, labels: [{ tex, x: len < 90 ? Math.max(mid[0] + nx * 4, Math.max(a[0], c[0]) + 48) : mid[0] + nx * 4, y: mid[1] + ny * 4, side: 'right' }] })
      }
    })
    return out
  })()

  let tip: { x: number; y: number; rows: ProbeRow[] } | null = null
  const at = active && positions[active.i]
  // A dragged handle names its value where it is: a guide shows its parameter, or – for a handle
  // that sits at its own value (x₀) – its label reads "x₀ = 23". Only handles that change
  // several parameters, or a derived one without a guide, still get the tooltip.
  const h0 = active ? handles[active.i] : undefined
  const shownByGuide = !!h0 && !h0.also?.length && (entry.guides?.(params) ?? []).some((g) => g.param === h0.param)
  const ownValue = !!h0 && !h0.at && !h0.also?.length && typeof params[h0.param] === 'number'
  const handleTip = !!active && !!at && !shownByGuide && !(ownValue && active.state === 'drag')
  if (active && at && handleTip) {
    const h = handles[active.i]
    const row = (id: string): ProbeRow => {
      const v = params[id]
      const value = Array.isArray(v) ? `(${v.map((c) => formatNumber(c, 3)).join(', ')})` : typeof v === 'number' ? formatNumber(v, 3) : String(v)
      return { tex: texOf?.(id) ?? id, value }
    }
    tip = { x: at[0], y: at[1], rows: [h.param, ...(h.also ?? [])].map(row) }
  } else if (source && probeGeom?.anchor && probeGeom.rows.length) {
    tip = { ...probeGeom.anchor, rows: probeGeom.rows }
  }

  return (
    <figure className="ab-figure" ref={outer} data-spot={markGeom.length > 0 || undefined}>
      <FigureHead title={spec.title}>
        {entry.logToggle && <AxisSwitch log={{ on: logY, set: setLogY, hilfe: entry.logHilfe }} />}
        {spec.type === 'phasePlane' && (
          <AspectSwitch
            equal={equal}
            set={(on) => {
              setEqual(on)
              setZoom(null)
            }}
          />
        )}
      </FigureHead>
      <div
        className="ab-figure-inner"
        data-ready={ready || undefined}
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
        onDoubleClick={() => {
          if (onBahn) return
          setZoom(null)
          setRefit((r) => r + 1)
        }}
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
          {guideGeom.map((g) => (
            <g key={g.id} className="ab-guide">
              <path d={g.d} />
              {g.head && <path d={g.head} />}
            </g>
          ))}
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
          const named = (typeof h.label === 'function' ? h.label(params) : h.label) ?? texOf?.(h.param)
          const dragged = active?.i === i && active.state === 'drag' && !h.at && !h.also?.length && typeof params[h.param] === 'number'
          const tex = named && dragged ? `${named} = ${texNumber(params[h.param] as number, 4)}` : named
          if (!pos || !tex || (active?.i === i && handleTip)) return null
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
        {guideGeom.flatMap((g) =>
          g.labels.map((l, j) => (
            <span key={`${g.id}-${j}`} className="ab-guide-label" data-side={l.side} style={{ left: l.x, top: l.y }} aria-hidden="true">
              <TeX tex={l.tex} />
            </span>
          )),
        )}
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
        {!autoAxes && !zoom && (held.current.overflow || held.current.roomy) && (
          <button
            type="button"
            className="ab-axis-fit"
            data-overflow={held.current.overflow || undefined}
            // at the top end of the y axis, left of the tip (and of a ×10ᵏ badge there): the
            // middle of the axis is where start-value handles sit
            style={{ left: fitButtonX, top: frame.plot.y - AXIS_OVERHANG + 1 }}
            onClick={() => setRefit((r) => r + 1)}
            data-tip={held.current.overflow ? 'Die Kurve reicht über den Rand: Achse anpassen' : 'Achse an die Kurve anpassen'}
            aria-label="Achse anpassen"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M8 2.5v11M5.2 5.3 8 2.5l2.8 2.8M5.2 10.7 8 13.5l2.8-2.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <FigureActions
          zoomBack={showBack ? zoomBack : undefined}
          zoomReset={
            showReset
              ? () => {
                  setZoom(null)
                  setRefit((r) => r + 1)
                }
              : undefined
          }
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
