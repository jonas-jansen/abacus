// Static pictures of applet plots, rendered by the plot library: thumbnails in the overview,
// and plots in quiz questions ("which plot belongs to a = 3.2?").

import { defaultParams, makeFrame, updateParams } from '@abacus/applet-core'
import { axesNode, DEFAULT_VIEW, drawPlot, plotDomains, scene3d, sceneSvg, svgToString, SvgPathSurface, type PlotSpec, type SvgNode } from '@abacus/applet-plot'
import type { AnyAppletDef } from '@abacus/applet-ui/define'

export interface PlotPicture {
  /** Parameters that differ from the defaults. */
  state?: Readonly<Record<string, unknown>>
  /** Which of the applet's plots (default: the first). */
  plot?: number
  width?: number
  height?: number
  /** Axis labels (off for thumbnails). */
  labels?: boolean
  alt?: string
}

export function plotSvg(def: AnyAppletDef, o: PlotPicture = {}): string {
  const { width = 360, height = 220 } = o
  const p = o.state ? updateParams(def.model, defaultParams(def.model), o.state) : defaultParams(def.model)
  const run = def.model.run(p)
  const entry = def.plots[o.plot ?? 0] ?? def.plots[0]
  const r = (d: unknown) => (typeof d === 'function' ? d(p) : d)
  const spec = { ...entry, x: r(entry.x), y: r(entry.y) } as PlotSpec
  let children: SvgNode[]
  if (spec.type === 'surface3d') {
    const grid = run.grids?.find((g) => g.id === spec.grid)
    children = grid ? sceneSvg(scene3d({ grid, width, height, view: DEFAULT_VIEW, fontSize: 11 })) : []
  } else {
    const d = plotDomains(spec, run)
    const labels = o.labels ? { x: spec.xLabel, y: spec.yLabel } : {}
    const frame = makeFrame({ width, height, x: d.x, y: d.y, xInteger: d.xInteger, yLog: spec.yScale === 'log', xLabel: labels.x, yLabel: labels.y })
    const s = new SvgPathSurface()
    drawPlot(s, frame, spec, run)
    children = [axesNode(frame, labels), { tag: 'g', attrs: { transform: `translate(${frame.plot.x} ${frame.plot.y})` }, children: s.nodes }]
  }
  return svgToString({
    tag: 'svg',
    attrs: { viewBox: `0 0 ${width} ${height}`, width: '100%', role: 'img', 'aria-label': o.alt ?? def.title },
    children,
  })
}

/** The overview's thumbnail: the first plot at the defaults. */
export const previewSvg = (def: AnyAppletDef, width = 360, height = 220) => plotSvg(def, { width, height })
