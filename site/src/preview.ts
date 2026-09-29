// Static thumbnail of an applet's first plot at its defaults, rendered at build time.

import { defaultParams, makeFrame } from '@abacus/applet-core'
import { axesNode, DEFAULT_VIEW, drawPlot, plotDomains, scene3d, sceneSvg, svgToString, SvgPathSurface, type PlotSpec, type SvgNode } from '@abacus/applet-plot'
import type { AnyAppletDef } from '@abacus/applet-ui/define'

export function previewSvg(def: AnyAppletDef, width = 360, height = 220): string {
  const p = defaultParams(def.model)
  const run = def.model.run(p)
  const entry = def.plots[0]
  const r = (d: unknown) => (typeof d === 'function' ? d(p) : d)
  const spec = { ...entry, x: r(entry.x), y: r(entry.y) } as PlotSpec
  let children: SvgNode[]
  if (spec.type === 'surface3d') {
    const grid = run.grids?.find((g) => g.id === spec.grid)
    children = grid ? sceneSvg(scene3d({ grid, width, height, view: DEFAULT_VIEW, fontSize: 11 })) : []
  } else {
    const d = plotDomains(spec, run)
    const frame = makeFrame({ width, height, x: d.x, y: d.y, xInteger: d.xInteger, yLog: spec.yScale === 'log' })
    const s = new SvgPathSurface()
    drawPlot(s, frame, spec, run)
    children = [axesNode(frame), { tag: 'g', attrs: { transform: `translate(${frame.plot.x} ${frame.plot.y})` }, children: s.nodes }]
  }
  return svgToString({
    tag: 'svg',
    attrs: { viewBox: `0 0 ${width} ${height}`, width: '100%', role: 'img', 'aria-label': def.titel },
    children,
  })
}
