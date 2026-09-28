/** Bottom SVG layer (§5.2): grid, axes, ticks, tick labels, axis labels. */

import { TICK, type Frame } from '@abacus/applet-core'
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

  nodes.push(line(plot.x, bottom, plot.x + plot.w, bottom, 'abacus-axis'))
  nodes.push(line(plot.x, plot.y, plot.x, bottom, 'abacus-axis'))

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

  if (labels.x) {
    nodes.push(mathText(labels.x, { x: plot.x + plot.w / 2, y: frame.height - 4, 'text-anchor': 'middle', class: 'abacus-axis-label' }))
  }
  if (labels.y) {
    // Horizontal at the top of the y axis: readable on phones, and the mathematical convention.
    nodes.push(mathText(labels.y, { x: plot.x, y: fontSize * 1.15, 'text-anchor': 'middle', class: 'abacus-axis-label' }))
  }

  return { tag: 'g', attrs: { 'font-size': fontSize }, children: nodes }
}
