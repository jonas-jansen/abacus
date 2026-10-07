import { defaultParams, iteration, makeFrame, real, int } from '@abacus/applet-core'
import { describe, expect, it } from 'vitest'
import { axesNode, drawPlot, holdRange, panFloors, roomy, plotDomains, svgToString, SvgPathSurface, timeEnd, type PlotSpec } from './index'

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
    expect(svg).toContain('0.5')
    expect(svg).toContain('−1')
  })
})

describe('axis factor', () => {
  it('scaled tick labels come with a ×10^k badge above the numbers', async () => {
    const { makeFrame } = await import('@abacus/applet-core')
    const { axesNode, svgToString } = await import('./index')
    const svg = svgToString(axesNode(makeFrame({ width: 500, height: 300, x: [0, 80], y: [0, 100_000], yLabel: 'x' }), { y: 'x' }))
    expect(svg).toMatch(/class="abacus-factor-bg"/)
    expect(svg).toMatch(/×10<\/tspan><tspan[^>]*>5</)
    expect(svg).not.toContain('times')
  })
})

describe('zoom rules and drawing details', () => {
  it('lets time start at its beginning and nonnegative quantities at 0', () => {
    const spec: PlotSpec = { type: 'timeSeriesDiscrete', series: ['x'] }
    const f = panFloors(spec, run, plotDomains(spec, run))
    expect(f.x).toBe(0)
    expect(f.y).toBe(0) // 0.5ⁿ is never negative
    const neg = model.run({ ...defaultParams(model), a: -0.5 })
    expect(panFloors(spec, neg, plotDomains(spec, neg)).y).toBe(-Infinity)
    expect(panFloors({ type: 'cobweb', f: 'f', orbit: 'x' }, run, plotDomains(spec, run))).toEqual({ x: -Infinity, y: -Infinity })
  })

  it('knows where the span of a plot over time ends', () => {
    expect(timeEnd({ type: 'timeSeriesDiscrete', series: ['x'] }, run)).toBe(10)
    expect(timeEnd({ type: 'cobweb', f: 'f', orbit: 'x' }, run)).toBeNull()
  })

  it('draws no line across a pole, but keeps two-point lines whole', () => {
    const t = Float64Array.from({ length: 101 }, (_, i) => -1 + i / 50)
    const pole = { series: [{ id: 'g', label: 'g', kind: 'continuous' as const, x: t, y: t.map((v) => 1 / v), role: 'primary' as const }], observables: {}, meta: {} }
    const spec: PlotSpec = { type: 'functionGraph', series: ['g'] }
    const frame = makeFrame({ width: 400, height: 300, x: [-1, 1], y: [-5, 5] })
    const moves = (r: typeof pole) => {
      const s = new SvgPathSurface()
      drawPlot(s, frame, spec, r)
      return (s.nodes.map((n) => String(n.attrs?.d)).join('').match(/M/g) ?? []).length
    }
    expect(moves(pole)).toBe(2) // two branches
    const line = { ...pole, series: [{ ...pole.series[0], x: Float64Array.of(-1, 1), y: Float64Array.of(-100, 100) }] }
    expect(moves(line)).toBe(1)
  })

  it('ends both axes in an arrowhead', () => {
    const frame = makeFrame({ width: 400, height: 300, x: [0, 10], y: [0, 1], xLabel: 't', yLabel: 'x' })
    expect(svgToString(axesNode(frame, { x: 't', y: 'x' })).match(/abacus-axis-arrow/g)).toHaveLength(2)
  })
})

describe('held axes', () => {
  it('keep the window while the data fits, so a new start value does not change the slope', () => {
    expect(holdRange([0, 100], [0, 60])).toEqual([0, 100])
    expect(holdRange([0, 100], [0, 99])).toEqual([0, 100])
  })
  it('move before they scale', () => {
    expect(holdRange([-2, 2], [1, 4])).toEqual([0, 4])
    expect(holdRange([-2, 2], [-5, -2])).toEqual([-5, -1])
  })
  it('grow in steps of two, keeping the side the data has not left, and keep 0 for quantities that are never negative', () => {
    expect(holdRange([0, 100], [0, 130])).toEqual([0, 200])
    expect(holdRange([0, 100], [0, 900])).toEqual([0, 800 * 2])
    expect(holdRange([-2, 2], [-1, 9])).toEqual([-2, 14])
  })
  it('never shrink on their own, but say when a refit would help', () => {
    expect(holdRange([0, 1000], [0, 10])).toEqual([0, 1000])
    expect(roomy([0, 1000], [0, 10])).toBe(true)
    expect(roomy([0, 100], [0, 40])).toBe(false)
  })
  it('on a log axis, work in powers of ten', () => {
    expect(holdRange([1, 100], [10, 1000], { log: true })).toEqual([10, 1000])
  })
  it('start from the data', () => expect(holdRange(null, [3, 4])).toEqual([3, 4]))
  it('without growing, keep the scale but move into the data', () => {
    expect(holdRange([0, 40], [297, 363], { grow: false })).toEqual([297, 337])
    expect(holdRange([0, 40], [-10, 70], { grow: false })).toEqual([0, 40])
    expect(holdRange([0, 40], [0, 90], { grow: false })).toEqual([0, 40])
  })
})
