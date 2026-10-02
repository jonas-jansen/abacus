/**
 * Zoom and pan of a plot: Ctrl/⌘ + wheel (also a trackpad pinch) zooms about the pointer,
 * Shift + drag pans, two fingers pinch and pan. A plain wheel still scrolls the page.
 * The window arithmetic is in zoom.ts; this hook only follows the pointer.
 */

import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import type { Frame } from '@abacus/applet-core'
import { allowed, floored, panned, pinched, zoomedAbout, type Win } from './zoom'
import { localPoint, scaleOf } from './scale'

export interface ZoomPan {
  /** Pointer down: true if a pan or pinch starts (then it is not a click). */
  down: (e: ReactPointerEvent<HTMLElement>) => boolean
  /** Pointer move: true if it moved the window. */
  move: (e: ReactPointerEvent<HTMLElement>) => boolean
  /** Pointer up or cancel. */
  end: (e: ReactPointerEvent<HTMLElement>) => void
}

export function useZoomPan({
  el,
  frame,
  full,
  floors,
  enabled,
  setZoom,
}: {
  el: RefObject<HTMLElement | null>
  frame: Frame
  full: Win
  floors: { x: number; y: number }
  enabled: boolean
  setZoom: (z: Win) => void
}): ZoomPan {
  const { plot } = frame
  const yLog = !!frame.yLog
  const current = (): Win => ({ x: frame.xDomain, y: frame.yDomain })
  const set = (z: Win, limit = true) => {
    if (!limit || allowed(full, z, yLog)) setZoom(floored(z, floors, yLog))
  }

  useEffect(() => {
    const node = el.current
    if (!node || !enabled) return
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const [lx, ly] = localPoint(node, e.clientX, e.clientY)
      const k = Math.exp(Math.max(-0.5, Math.min(0.5, e.deltaY * 0.01)))
      set(zoomedAbout(current(), frame.xInvert(lx - plot.x), frame.yInvert(ly - plot.y), k, k, yLog))
    }
    node.addEventListener('wheel', wheel, { passive: false })
    return () => node.removeEventListener('wheel', wheel)
  })

  const pan = useRef<{ x: number; y: number; k: number; from: Win } | null>(null)
  const touches = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d: number; cx: number; cy: number; from: Win } | null>(null)
  const local = (e: ReactPointerEvent<HTMLElement>, x: number, y: number) => {
    const [lx, ly] = localPoint(e.currentTarget, x, y)
    return [lx - plot.x, ly - plot.y] as const
  }

  return {
    down(e) {
      if (!enabled) return false
      if (e.pointerType === 'touch') {
        touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (touches.current.size !== 2) return false
        const [a, b] = [...touches.current.values()]
        const [cx, cy] = local(e, (a.x + b.x) / 2, (a.y + b.y) / 2)
        pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), cx, cy, from: current() }
        return true
      }
      if (!e.shiftKey) return false
      e.preventDefault() // Shift + press would otherwise select text on the page
      e.currentTarget.setPointerCapture(e.pointerId)
      pan.current = { x: e.clientX, y: e.clientY, k: scaleOf(e.currentTarget), from: current() }
      return true
    },
    move(e) {
      if (pan.current) {
        const p = pan.current
        set(panned(p.from, (e.clientX - p.x) / p.k, (e.clientY - p.y) / p.k, plot.w, plot.h, yLog), false)
        return true
      }
      if (e.pointerType !== 'touch' || !touches.current.has(e.pointerId)) return false
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const p = pinch.current
      if (!p || touches.current.size !== 2) return false
      const [a, b] = [...touches.current.values()]
      const k = p.d / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))
      // zoom about the first centre, then follow the fingers
      const [cx, cy] = local(e, (a.x + b.x) / 2, (a.y + b.y) / 2)
      set(pinched(p.from, frame.xInvert(p.cx), frame.yInvert(p.cy), k, cx - p.cx, cy - p.cy, plot.w, plot.h, yLog))
      return true
    },
    end(e) {
      pan.current = null
      touches.current.delete(e.pointerId)
      if (touches.current.size < 2) pinch.current = null
    },
  }
}
