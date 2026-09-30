import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Run } from '@abacus/applet-core'
import { DEFAULT_VIEW, scene3d, sceneSvg, type PlotSpec, type Stroke, type View3D } from '@abacus/applet-plot'
import { renderSvg } from './svgReact'
import { TeX } from './TeX'

const SSR_WIDTH = 520
const MAX = 560

export type Spec3D = Extract<PlotSpec, { type: 'surface3d' }>

/**
 * A rotatable surface. Drag to turn it (on touch: sideways only, so vertical swipes still
 * scroll the page); double-click to return to the default view.
 */
export function Figure3D({
  spec,
  run,
  dragParam,
  onParams,
}: {
  spec: Spec3D
  run: Run
  /** A point parameter shown as the grid's marker, dragged along the floor. */
  dragParam?: string
  onParams?: (patch: Record<string, unknown>) => void
}) {
  const outer = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(SSR_WIDTH)
  const [hydrated, setHydrated] = useState(false)
  const [view, setView] = useState<View3D>(DEFAULT_VIEW)
  // marker drags keep the offset from the pointer to the point's foot on the floor
  const drag = useRef<{ x: number; y: number; v: View3D; marker: boolean; off: [number, number] } | null>(null)
  const [overMarker, setOverMarker] = useState(false)

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

  const size = Math.min(width, MAX)
  const h = Math.round(size * 0.86)
  const grid = run.grids?.find((g) => g.id === spec.grid)
  const scene = useMemo(
    () => (grid ? scene3d({ grid, width: size, height: h, view, labels: { x: spec.xLabel, y: spec.yLabel, z: spec.zLabel ?? grid.label }, fontSize: size < 400 ? 11 : 12 }) : null),
    [grid, size, h, view, spec.xLabel, spec.yLabel, spec.zLabel],
  )

  useEffect(() => {
    if (!hydrated || !scene) return
    const id = requestAnimationFrame(() => {
      const cv = canvas.current
      const ctx = cv?.getContext('2d')
      if (!cv || !ctx) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      cv.width = Math.round(size * dpr)
      cv.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size, h)
      const css = getComputedStyle(cv)
      const stroke: Record<Stroke, string> = {
        contour: css.getPropertyValue('--ab-text').trim() || '#15181c',
        marker: css.getPropertyValue('--ab-text').trim() || '#15181c',
        axis: css.getPropertyValue('--abacus-axis').trim() || '#a3aab4',
      }
      ctx.lineCap = 'round'
      ctx.strokeStyle = stroke.axis
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let k = 0; k < scene.floor.length; k += 4) {
        ctx.moveTo(scene.floor[k], scene.floor[k + 1])
        ctx.lineTo(scene.floor[k + 2], scene.floor[k + 3])
      }
      ctx.stroke()
      for (const it of scene.items) {
        ctx.beginPath()
        ctx.moveTo(it.pts[0], it.pts[1])
        for (let k = 2; k < it.pts.length; k += 2) ctx.lineTo(it.pts[k], it.pts[k + 1])
        if (it.kind === 'poly') {
          ctx.closePath()
          ctx.fillStyle = it.fill
          ctx.strokeStyle = it.fill // hides hairline seams between cells
          ctx.lineWidth = 0.6
          ctx.fill()
          ctx.stroke()
        } else {
          ctx.strokeStyle = stroke[it.stroke]
          ctx.lineWidth = it.width
          ctx.stroke()
        }
      }
      if (scene.marker) {
        const m = scene.marker
        ctx.setLineDash([3, 3])
        ctx.strokeStyle = stroke.marker
        ctx.lineWidth = 1.25
        ctx.beginPath()
        ctx.moveTo(m.fx, m.fy)
        ctx.lineTo(m.x, m.y)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = css.getPropertyValue('--ab-bg').trim() || '#fff'
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.arc(m.x, m.y, 5.5, 0, 2 * Math.PI)
        ctx.fill()
        ctx.stroke()
      }
    })
    return () => cancelAnimationFrame(id)
  }, [hydrated, scene, size, h])

  const local = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top] as const
  }
  // Near the marker (its dot or its foot): the pointer moves the point, not the view.
  const nearMarker = (px: number, py: number) => {
    const m = scene?.marker
    if (!m || !dragParam) return false
    return Math.hypot(px - m.x, py - m.y) < 18 || Math.hypot(px - m.fx, py - m.fy) < 18
  }
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const [px, py] = local(e)
    const m = scene?.marker
    drag.current = { x: e.clientX, y: e.clientY, v: view, marker: nearMarker(px, py), off: m ? [m.fx - px, m.fy - py] : [0, 0] }
  }
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) {
      if (e.pointerType === 'mouse') setOverMarker(nearMarker(...local(e)))
      return
    }
    if (d.marker && scene && grid && dragParam) {
      const [px, py] = local(e)
      const [x, y] = scene.floorAt(px + d.off[0], py + d.off[1])
      const clampTo = (v: number, a: ArrayLike<number>) => Math.min(a[a.length - 1], Math.max(a[0], v))
      onParams?.({ [dragParam]: [clampTo(x, grid.x), clampTo(y, grid.y)] })
      return
    }
    const touch = e.pointerType !== 'mouse'
    setView({
      az: d.v.az + (e.clientX - d.x) * 0.012,
      el: touch ? d.v.el : Math.min(1.45, Math.max(0.05, d.v.el + (e.clientY - d.y) * 0.01)),
    })
  }
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return (
    <figure className="ab-figure ab-figure-3d" ref={outer}>
      <div
        className="ab-figure-inner"
        style={{ width: size, height: h, touchAction: 'pan-y', cursor: overMarker ? 'move' : 'grab' }}
        role="img"
        aria-label={spec.title ?? `Fläche ${spec.zLabel ?? 'z'} über ${spec.xLabel ?? 'x'} und ${spec.yLabel ?? 'y'}, drehbar`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onDoubleClick={() => setView(DEFAULT_VIEW)}
        data-tip={'{Ziehen} | drehen\n{Doppelklick} | zurück zur ersten Ansicht'}
        data-tip-at="pointer"
      >
        {hydrated ? (
          <canvas ref={canvas} className="ab-data" style={{ position: 'absolute', inset: 0, width: size, height: h }} aria-hidden="true" />
        ) : (
          scene && (
            <svg width={size} height={h} className="ab-layer" aria-hidden="true">
              {sceneSvg(scene).map((n, i) => renderSvg(n, i))}
            </svg>
          )
        )}
        {scene && (
          <svg width={size} height={h} className="ab-layer ab-top" aria-hidden="true">
            {renderSvg(scene.labels)}
          </svg>
        )}
      </div>
      <figcaption>
        {grid?.ref && (
          <>
            <span className="ab-legend-item">
              <span className="ab-swatch" style={{ background: 'hsl(24 86% 55%)' }} />
              <TeX tex={`${grid.label} > ${grid.refLabel ?? 'z_0'}`} />
            </span>
            <span className="ab-legend-item">
              <span className="ab-swatch" style={{ background: 'hsl(218 78% 55%)' }} />
              <TeX tex={`${grid.label} < ${grid.refLabel ?? 'z_0'}`} />
            </span>
          </>
        )}
        <span className="ab-legend-hint">{dragParam ? 'Punkt ziehen oder Fläche drehen' : 'ziehen zum Drehen'}</span>
      </figcaption>
    </figure>
  )
}
