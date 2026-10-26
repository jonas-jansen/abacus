/**
 * Zoom and pan of a plot: Ctrl/⌘ + wheel (also a trackpad pinch) zooms about the pointer,
 * Shift + drag pans; on a touch screen two fingers do both, pinching and moving together. A
 * plain wheel, like one finger, still scrolls the page.
 * The window arithmetic is in zoom.ts; this hook only follows the pointer.
 */

import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import type { Frame } from '@abacus/applet-core'
import { allowed, floored, inside, panned, pinched, zoomedAbout, type Win } from './zoom'
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
  bounded = false,
  setZoom,
}: {
  el: RefObject<HTMLElement | null>
  frame: Frame
  full: Win
  floors: { x: number; y: number }
  enabled: boolean
  /** Zoom and pan stay inside the whole picture (all plots but phase planes). */
  bounded?: boolean
  /** The new window; null = the whole picture. */
  setZoom: (z: Win | null) => void
}): ZoomPan {
  const { plot } = frame
  const yLog = !!frame.yLog
  const current = (): Win => ({ x: frame.xDomain, y: frame.yDomain })
  const set = (z: Win, limit = true) => {
    // `limit` is false only for a pan
    if (bounded) setZoom(inside(z, full, yLog, limit ? 'zoom' : 'pan'))
    else if (!limit || allowed(full, z, yLog)) setZoom(floored(z, floors, yLog))
  }

  // two fingers on the plot: where they started, and the window then
  const fingers = useRef<{ d: number; cx: number; cy: number; from: Win } | null>(null)

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
    // Two fingers: read from the touch events themselves, which may cancel the page's own
    // gesture (preventDefault). Pointer events would be cancelled by the browser as soon as it
    // takes two moving fingers for scrolling, which is what an iPad does.
    const centre = (t: TouchList) => {
      const [a, b] = [t[0], t[1]]
      const [lx, ly] = localPoint(node, (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2)
      return { cx: lx - plot.x, cy: ly - plot.y, d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) }
    }
    const tstart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      e.preventDefault()
      const c = centre(e.touches)
      fingers.current = { ...c, from: current() }
    }
    const tmove = (e: TouchEvent) => {
      const f = fingers.current
      if (!f || e.touches.length !== 2) return
      e.preventDefault()
      const c = centre(e.touches)
      const k = f.d / Math.max(1, c.d)
      // zoom about the first centre, then follow the fingers
      set(pinched(f.from, frame.xInvert(f.cx), frame.yInvert(f.cy), k, c.cx - f.cx, c.cy - f.cy, plot.w, plot.h, yLog))
    }
    const tend = (e: TouchEvent) => {
      if (e.touches.length < 2) fingers.current = null
    }
    node.addEventListener('touchstart', tstart, { passive: false })
    node.addEventListener('touchmove', tmove, { passive: false })
    node.addEventListener('touchend', tend)
    node.addEventListener('touchcancel', tend)
    return () => {
      node.removeEventListener('wheel', wheel)
      node.removeEventListener('touchstart', tstart)
      node.removeEventListener('touchmove', tmove)
      node.removeEventListener('touchend', tend)
      node.removeEventListener('touchcancel', tend)
    }
  })

  const pan = useRef<{ x: number; y: number; k: number; from: Win } | null>(null)

  return {
    down(e) {
      if (!enabled) return false
      // fingers: a second one makes it a pinch (the touch listeners above); one alone is no pan
      if (e.pointerType === 'touch') return fingers.current !== null
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
      // while two fingers zoom, a finger's pointer moves are theirs, not the plot's probe
      return e.pointerType === 'touch' && fingers.current !== null
    },
    end() {
      pan.current = null
    },
  }
}
