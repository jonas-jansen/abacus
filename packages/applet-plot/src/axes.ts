/** Bottom SVG layer (§5.2): grid, axes, ticks, tick labels, axis labels. */

import { AXIS_OVERHANG, estimateTextWidth, labelWidth, TICK, type Frame } from '@abacus/applet-core'
import { mathText } from './mathText'
import type { SvgNode } from './svg'

export function axesNode(frame: Frame, labels: { x?: string; y?: string } = {}): SvgNode {
  const { plot, fontSize } = frame
  const X = (v: number) => plot.x + frame.xScale(v)
  const Y = (v: number) => plot.y + frame.yScale(v)
  const bottom = plot.y + plot.h
  const nodes: SvgNode[] = []
  const line = (x1: number, y1: number, x2: number, y2: number, cls: string): SvgNode => ({
    tag: 'line',
    attrs: { x1, y1, x2, y2, class: cls },
  })

  for (const t of frame.xTicks) nodes.push(line(X(t), plot.y, X(t), bottom, 'abacus-grid'))
  for (const t of frame.yTicks) nodes.push(line(plot.x, Y(t), plot.x + plot.w, Y(t), 'abacus-grid'))

  // Zero lines are drawn a bit stronger than the grid when zero lies inside the domain.
  const [x0, x1] = frame.xDomain
  const [y0, y1] = frame.yDomain
  if (x0 < 0 && x1 > 0) nodes.push(line(X(0), plot.y, X(0), bottom, 'abacus-zero'))
  if (y0 < 0 && y1 > 0) nodes.push(line(plot.x, Y(0), plot.x + plot.w, Y(0), 'abacus-zero'))

  // Both axes run a little past the plot and end in a stealth arrow, as in the slides.
  const tipX = plot.x + plot.w + AXIS_OVERHANG
  const tipY = plot.y - AXIS_OVERHANG
  nodes.push(line(plot.x, bottom, tipX - 5, bottom, 'abacus-axis'))
  nodes.push(line(plot.x, bottom, plot.x, tipY + 5, 'abacus-axis'))
  nodes.push({ tag: 'path', attrs: { d: `M${tipX} ${bottom}l-10 -4l2.8 4l-2.8 4z`, class: 'abacus-axis-arrow' } })
  nodes.push({ tag: 'path', attrs: { d: `M${plot.x} ${tipY}l-4 10l4 -2.8l4 2.8z`, class: 'abacus-axis-arrow' } })

  frame.xTicks.forEach((t, i) => {
    nodes.push(line(X(t), bottom, X(t), bottom + TICK, 'abacus-axis'))
    nodes.push({
      tag: 'text',
      attrs: { x: X(t), y: bottom + TICK + 3, 'text-anchor': 'middle', 'dominant-baseline': 'hanging', class: 'abacus-tick' },
      text: frame.xTickLabels[i],
    })
  })
  frame.yTicks.forEach((t, i) => {
    nodes.push(line(plot.x - TICK, Y(t), plot.x, Y(t), 'abacus-axis'))
    nodes.push({
      tag: 'text',
      attrs: { x: plot.x - TICK - 4, y: Y(t), 'text-anchor': 'end', 'dominant-baseline': 'central', class: 'abacus-tick' },
      text: frame.yTickLabels[i],
    })
  })

  // The variables at the arrow tips: y to the right of the upper tip, x right of the right tip.
  const yLabelY = tipY + fontSize * 0.35
  if (labels.y) {
    nodes.push(mathText(labels.y, { x: plot.x + 9, y: yLabelY, 'text-anchor': 'start', class: 'abacus-axis-label' }))
  }
  if (labels.x) {
    nodes.push(mathText(labels.x, { x: tipX + 5, y: bottom, 'dominant-baseline': 'central', 'text-anchor': 'start', class: 'abacus-axis-label' }))
  }
  // A power of ten that scales all numbers of an axis stands with those numbers: on top of the
  // y numbers, and after the last x number – where one reads them, not beside the label.
  const factor = (e: number) => `\\cdot 10^{${e}}`
  if (frame.yExp) {
    nodes.push(mathText(factor(frame.yExp), { x: plot.x - TICK - 4, y: yLabelY, 'text-anchor': 'end', class: 'abacus-factor' }))
  }
  if (frame.xExp && frame.xTicks.length) {
    const i = frame.xTicks.length - 1
    const rechts = X(frame.xTicks[i]) + estimateTextWidth(frame.xTickLabels[i], fontSize) / 2
    nodes.push(mathText(factor(frame.xExp), { x: rechts + 6, y: bottom + TICK + 3 + fontSize * 0.82, 'text-anchor': 'start', class: 'abacus-factor' }))
  }

  return { tag: 'g', attrs: { 'font-size': fontSize }, children: nodes }
}
