import { defaultParams, iteration, makeFrame, real, int } from '@abacus/applet-core'
import { describe, expect, it } from 'vitest'
import { axesNode, drawPlot, plotDomains, svgToString, SvgPathSurface, type PlotSpec } from './index'

const model = iteration({
  id: 'geo',
  params: { a: real('a', { min: -2, max: 2, step: 0.01, default: 0.5 }), N: int('N', { min: 1, max: 50, default: 10 }) },
  start: () => 1,
  step: (x, p) => p.a * x,
  horizon: (p) => p.N,
  extraSeries: ({ map }) => {
    const x = Float64Array.from({ length: 11 }, (_, i) => i / 10)
    return [{ id: 'f', label: 'f', kind: 'continuous', x, y: x.map(map), role: 'primary' }]
  },
})
const run = model.run(defaultParams(model))

describe('plots', () => {
  it('discrete time series: integer x domain, one dot per visible step', () => {
    const spec: PlotSpec = { type: 'timeSeriesDiscrete', series: ['x'] }
    const d = plotDomains(spec, run)
    expect(d.x).toEqual([0, 10])
    expect(d.xInteger).toBe(true)
    const frame = makeFrame({ width: 400, height: 300, ...d })
    const s = new SvgPathSurface()
    drawPlot(s, frame, spec, run, { steps: 3 })
    const dotsPath = s.nodes.find((n) => n.attrs?.fill !== 'none')!
    expect(String(dotsPath.attrs!.d).match(/Z/g)).toHaveLength(4)
  })

  it('cobweb staircase grows with the steps', () => {
    const spec: PlotSpec = { type: 'cobweb', f: 'f', orbit: 'x' }
    const frame = makeFrame({ width: 400, height: 400, ...plotDomains(spec, run) })
    const len = (steps: number) => {
      const s = new SvgPathSurface()
      drawPlot(s, frame, spec, run, { steps })
      return s.nodes.map((n) => String(n.attrs?.d)).join('').length
    }
    expect(len(5)).toBeGreaterThan(len(1))
  })

  it('axes serialise to SVG with German tick labels', () => {
    const frame = makeFrame({ width: 400, height: 300, x: [0, 1], y: [-1, 1] })
    const svg = svgToString(axesNode(frame, { x: 't', y: 'x(t)' }))
    expect(svg).toContain('0,5')
    expect(svg).toContain('−1')
  })
})
