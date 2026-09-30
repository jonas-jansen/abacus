/** Drag handles in a figure: where they sit, and dragging them. */

import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { type Frame, type Params, type Point } from '@abacus/applet-core'
import { type DragHandle } from './define'

/** Where a drag handle sits, in figure coordinates; null when it cannot be placed. */
export function handlePosition(drag: DragHandle<any>, frame: Frame, params: Params): [number, number] | null {
  let dx: number
  let dy: number
  if (drag.at) {
    const a = drag.at(params)
    if (!a) return null
    ;[dx, dy] = a
  } else {
    const v = params[drag.param]
    if (drag.axis === 'xy') [dx, dy] = v as Point
    // a value handle sits at 0 of the other axis (a start value at t = 0), and like every
    // handle it is hidden while that place is out of view (zoomed or panned away)
    else if (drag.axis === 'x') [dx, dy] = [v as number, 0]
    else [dx, dy] = [0, v as number]
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
export function Handle({
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
