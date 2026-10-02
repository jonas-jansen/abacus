import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  readOff,
  behaviourClass,
  createRng,
  decodeApplet,
  defaultParams,
  explainChange,
  detectPeriod,
  events,
  fixedPoints,
  formatNumber,
  int,
  iterateTail,
  iteration,
  MAX_ZOOM_OUT,
  steps,
  makeFrame,
  niceTicks,
  parseNumber,
  point,
  real,
  bool,
  choice,
  rk45,
  rosenbrock,
  ode,
  limitOf,
  threshold,
  sweepTail,
  updateParams,
  writeApplet,
} from './index'

const logistic = (a: number) => (x: number) => a * x * (1 - x)

describe('period detection (§12)', () => {
  const periodAt = (a: number) => detectPeriod(iterateTail(logistic(a), 0.2, 2000, 64))
  it.each([
    [2.5, 1],
    [3.2, 2],
    [3.5, 4],
    [3.9, null],
  ])('a = %s → %s', (a, p) => expect(periodAt(a)).toBe(p))

  it('treats divergence as not detected, not as 0', () => {
    expect(detectPeriod([1, 10, 100, Infinity])).toBeNull()
  })
})

describe('fixed points', () => {
  it('finds 0 and 1 − 1/a with f′ = 2 − a (logistic_a answer key)', () => {
    for (const a of [1.5, 2.5, 2.9, 3.1]) {
      const fps = fixedPoints(logistic(a), -0.1, 1.1)
      expect(fps.map((f) => f.x)).toEqual([expect.closeTo(0, 9), expect.closeTo(1 - 1 / a, 9)])
      expect(fps[1].slope).toBeCloseTo(2 - a, 5)
    }
  })

  it('logistic_rK: f′(K) = 1 − r independent of K', () => {
    for (const K of [1, 10, 50]) {
      const f = (x: number) => x + 1.5 * (1 - x / K) * x
      const fp = fixedPoints(f, 0.5 * K, 1.5 * K)[0]
      expect(fp.x).toBeCloseTo(K, 8)
      expect(fp.slope).toBeCloseTo(1 - 1.5, 5)
    }
  })
})

describe('behaviour', () => {
  it('classifies simple tails', () => {
    expect(behaviourClass([1, 0.5, 0.25, 0.125])).toBe('monotone')
    expect(behaviourClass([1, -0.5, 0.25, -0.125])).toBe('oscillating')
    expect(behaviourClass([1, 1e5, 1e10])).toBe('divergent')
  })
})

describe('rk45', () => {
  it("solves y' = −y to tolerance, with accurate dense output between steps", () => {
    const sol = rk45((_t, y) => [-y[0]], 0, [1], 5, { rtol: 1e-8, atol: 1e-10 })
    for (let t = 0; t <= 5; t += 0.137) expect(sol.at(t)[0]).toBeCloseTo(Math.exp(-t), 6)
  })

  it('harmonic oscillator keeps phase over several periods', () => {
    const sol = rk45((_t, y) => [y[1], -y[0]], 0, [1, 0], 20, { rtol: 1e-9, atol: 1e-12 })
    const { t, y } = sol.sample(101)
    for (let j = 0; j < t.length; j++) expect(y[0][j]).toBeCloseTo(Math.cos(t[j]), 6)
  })

  it('locates events on dense output, not on the sample grid', () => {
    // half-life of exp(-0.3 t): ln 2 / 0.3
    const sol = rk45((_t, y) => [-0.3 * y[0]], 0, [1], 10, { rtol: 1e-9, atol: 1e-12 })
    const [tHalf] = events(sol, (_t, y) => y[0] - 0.5)
    expect(tHalf).toBeCloseTo(Math.LN2 / 0.3, 7)
  })

  it('error decreases with tolerance (sanity check on the embedded pair)', () => {
    const err = (tol: number) => {
      const sol = rk45((_t, y) => [y[0] * Math.cos(_t)], 0, [1], 10, { rtol: tol, atol: tol * 1e-2 })
      return Math.abs(sol.at(10)[0] - Math.exp(Math.sin(10)))
    }
    expect(err(1e-9)).toBeLessThan(err(1e-5))
    expect(err(1e-9)).toBeLessThan(1e-7)
  })
})

// A model with every parameter kind and a coupling, for the property tests.
const coupled = iteration({
  id: 'test',
  params: {
    alpha: real('α', { min: 0, max: 1, step: 0.01, default: 0.3, limits: { min: 0, max: 1, reason: 'Anteil' } }),
    gamma: real('γ', { min: 0, max: 1, step: 0.01, default: 0.2, limits: { min: 0, max: 1, reason: 'Anteil' } }),
    N: int('N', { min: 1, max: 20, default: 20, limits: { min: 1, max: 100, reason: 'zu viele' } }),
    m: choice('Methode', [{ value: 'euler', label: 'Euler' }, { value: 'heun', label: 'Heun' }], 'euler'),
    on: bool('an', { labelOn: 'an', labelOff: 'aus', default: false }),
    s: point('Start', { xBounds: [-2, 2], yBounds: [-2, 2], default: [1, 0] }),
  },
  // α + γ ≤ 1, as in SIR
  normalize: (p) => (p.alpha + p.gamma <= 1 ? p : { ...p, gamma: 1 - p.alpha }),
  start: () => 1,
  step: (x, p) => (1 - p.alpha) * x,
  horizon: (p) => p.N,
})

const arbParams = fc.record({
  alpha: fc.double({ min: -1, max: 2, noNaN: true }),
  gamma: fc.double({ min: -1, max: 2, noNaN: true }),
  N: fc.integer({ min: -10, max: 200 }),
  m: fc.constantFrom('euler', 'heun'),
  on: fc.boolean(),
  s: fc.tuple(fc.double({ min: -3, max: 3, noNaN: true }), fc.double({ min: -3, max: 3, noNaN: true })),
})

describe('rosenbrock (§4.7)', () => {
  // y' = −10⁵ (y − cos t) − sin t, y(0) = 1: exact y = cos t, stiffness ratio 10⁵.
  const stiff = (t: number, y: Float64Array) => [-1e5 * (y[0] - Math.cos(t)) - Math.sin(t)]

  it('is accurate on a stiff problem with few steps', () => {
    const sol = rosenbrock(stiff, 0, [1], 10, { rtol: 1e-6, atol: 1e-9 })
    for (const t of [0.5, 3, 7.3, 10]) expect(sol.at(t)[0]).toBeCloseTo(Math.cos(t), 4)
    expect(sol.warnings).toEqual([])
    expect(sol.steps).toBeLessThan(8000)
  })

  it('finishes where rk45 gives up', () => {
    const r = rk45(stiff, 0, [1], 10, { rtol: 1e-6, atol: 1e-9 })
    const s = rosenbrock(stiff, 0, [1], 10, { rtol: 1e-6, atol: 1e-9 })
    // rk45 is limited by stability (h ≲ 3/λ) and runs into its step cap; ROS2 is not
    expect(r.warnings.join()).toContain('Abbruch')
    expect(s.warnings).toEqual([])
  })

  it('solves a 2×2 linear system (exact solution by eigen-decomposition)', () => {
    // y' = [[−2, 1], [1, −2]] y, y(0) = (1, 0): y = ½(e^{−t} + e^{−3t}, e^{−t} − e^{−3t})
    const sol = rosenbrock((_t, y) => [-2 * y[0] + y[1], y[0] - 2 * y[1]], 0, [1, 0], 3)
    const [a, b] = sol.at(1.7)
    expect(a).toBeCloseTo((Math.exp(-1.7) + Math.exp(-5.1)) / 2, 5)
    expect(b).toBeCloseTo((Math.exp(-1.7) - Math.exp(-5.1)) / 2, 5)
  })

  it("the ode builder switches automatically with stiff: 'auto'", () => {
    const m = ode({
      id: 't',
      params: { k: real('k', { min: 1, max: 1e6, step: 1, default: 1e5 }) },
      components: [{ id: 'y', label: 'y' }],
      start: () => [1],
      rhs: (t, y, p) => [-p.k * (y[0] - Math.cos(t)) - Math.sin(t)],
      tEnd: 10,
      stiff: 'auto',
    })
    const run = m.run(defaultParams(m))
    expect(run.meta.solver).toBe('rosenbrock')
    expect(run.series[0].y.at(-1)).toBeCloseTo(Math.cos(10), 5)
  })
})

describe('limitOf', () => {
  it('reports round-off-sized limits as 0', () => {
    const xs = Float64Array.from({ length: 2000 }, (_, n) => 5 * 0.8 ** n)
    expect(limitOf(xs, { tol: 1e-4 })).toBe(0)
  })
})

describe('normalize (§4.2)', () => {
  it('is idempotent and keeps values in range', () => {
    fc.assert(
      fc.property(arbParams, (raw) => {
        const p = updateParams(coupled, defaultParams(coupled), raw)
        expect(coupled.normalize!(p)).toEqual(p)
        expect(p.alpha + p.gamma).toBeLessThanOrEqual(1 + 1e-12)
        expect(p.N).toBeGreaterThanOrEqual(1)
        expect(p.N).toBeLessThanOrEqual(100)
      }),
    )
  })
})

describe('input feedback', () => {
  const base = defaultParams(coupled)
  it('slider ranges do not restrict typed values; hard limits do, with a reason', () => {
    expect(explainChange(coupled, base, 'N', 60)).toEqual({ params: { ...base, N: 60 } })
    expect(explainChange(coupled, base, 'N', 500)).toMatchObject({ params: { N: 100 }, message: 'zu viele' })
    expect(explainChange(coupled, base, 'N', 7.4).message).toContain('ganze Zahlen')
  })

  it('explains adjustments made by a coupling', () => {
    const r = explainChange(coupled, { ...base, alpha: 0.9, gamma: 0.1 }, 'gamma', 0.5)
    expect(r.params.gamma).toBeCloseTo(0.1)
    expect(r.message).toBeDefined()
  })

  it('rejects text that is no number', () => {
    expect(explainChange(coupled, base, 'alpha', 'viel').message).toContain('keine Zahl')
  })
})

describe('URL codec (§4.9)', () => {
  it('round-trips through normalize', () => {
    fc.assert(
      fc.property(arbParams, (raw) => {
        const base = defaultParams(coupled)
        const p = updateParams(coupled, base, raw)
        const hash = writeApplet('#other.a=1', 'test', coupled.params, p, base)
        const back = updateParams(coupled, base, decodeApplet(hash, 'test', coupled.params))
        for (const k of ['alpha', 'gamma'] as const) expect(back[k]).toBeCloseTo(p[k], 5)
        expect(back.s[0]).toBeCloseTo(p.s[0], 5)
        expect({ ...back, alpha: 0, gamma: 0, s: 0 }).toEqual({ ...p, alpha: 0, gamma: 0, s: 0 })
        expect(hash.startsWith('other.a=1')).toBe(true)
      }),
    )
  })

  it('only writes changed values and ignores foreign or invalid entries', () => {
    const base = defaultParams(coupled)
    expect(writeApplet('', 'test', coupled.params, { ...base, alpha: 0.5 }, base)).toBe('test.alpha=0.5')
    expect(decodeApplet('#test.alpha=abc&test.nope=1&x.alpha=0.1&test.N=7', 'test', coupled.params)).toEqual({ N: 7 })
  })
})

describe('frame (§5.6)', () => {
  it('ticks sit on a 1–2–5 ladder and index axes are integral', () => {
    expect(niceTicks(0, 1, 5).ticks).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1])
    expect(niceTicks(0, 7, 20, true).ticks).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it.each([320, 768, 1440])('tick density follows width %i', (width) => {
    const f = makeFrame({ width, height: width * 0.75, x: [0, 80], y: [-1, 1], xInteger: true, xLabel: 'n', yLabel: 'xₙ' })
    // numbers as dense as they fit, at least 36 px apart; short ticks for every n in between
    const gaps = f.xTicks.slice(1).map((t, i) => f.xScale(t) - f.xScale(f.xTicks[i]))
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(35)
    expect(f.xMinorTicks.every((t) => Number.isInteger(t) && !f.xTicks.includes(t))).toBe(true)
    expect(f.xScale(0)).toBe(0)
    expect(f.xScale(80)).toBeCloseTo(f.plot.w)
    expect(f.yInvert(f.yScale(0.3))).toBeCloseTo(0.3)
    expect(f.fontSize).toBeGreaterThanOrEqual(11)
  })

  it('numbers every n where there is room, short ticks for every n where there is not', () => {
    const wide = makeFrame({ width: 900, height: 600, x: [0, 20], y: [0, 1], xInteger: true })
    expect(wide.xTicks).toEqual(Array.from({ length: 21 }, (_, n) => n))
    const dense = makeFrame({ width: 900, height: 600, x: [0, 60], y: [0, 1], xInteger: true })
    expect(dense.xTicks.length).toBeLessThan(61)
    expect([...dense.xTicks, ...dense.xMinorTicks].sort((a, b) => a - b)).toEqual(Array.from({ length: 61 }, (_, n) => n))
    const far = makeFrame({ width: 400, height: 300, x: [0, 2000], y: [0, 1], xInteger: true })
    expect(far.xMinorTicks.length).toBeLessThan(200)
  })

  it('is deterministic (SSR and client agree)', () => {
    const input = { width: 500, height: 300, x: [0, 10] as const, y: [0, 1] as const }
    expect(JSON.stringify(makeFrame(input))).toBe(JSON.stringify(makeFrame(input)))
  })
})

describe('checkers (§8.2)', () => {
  it('schwelle gives direction and nudge', () => {
    const check = threshold({ target: 3, tolerance: 0.05, tooSmall: (v) => `bei ${formatNumber(v)} noch Fixpunkt` })
    expect(check('3,02', {}, {})).toEqual({ status: 'correct', hint: undefined })
    expect(check('2,9', {}, {})).toMatchObject({ status: 'close', direction: 'too small', hint: 'bei 2,9 noch Fixpunkt' })
    expect(check('4', {}, {})).toMatchObject({ status: 'wrong', direction: 'too large' })
    expect(check('drei', {}, {})).toMatchObject({ status: 'wrong' })
  })

  it('ablesen compares against observables and respects null', () => {
    const check = readOff({ observable: 'fp', tolerance: 0.01 })
    const obs = { fp: { kind: 'list' as const, label: 'Fixpunkte', value: [0, 0.6] } }
    expect(check('0.6', {}, obs).status).toBe('correct')
    expect(check('0.5', {}, { fp: { kind: 'quantity', label: '', value: null, note: 'nicht gefunden' } })).toEqual({
      status: 'saved',
      hint: 'nicht gefunden',
    })
  })
})

describe('misc', () => {
  it('parses German numbers', () => {
    expect(parseNumber('3,45')).toBe(3.45)
    expect(parseNumber('−2')).toBe(-2)
    // powers of ten as the fields show them
    expect(parseNumber('5·10⁻⁶')).toBe(5e-6)
    expect(parseNumber('2,5 · 10¹²')).toBe(2.5e12)
    expect(parseNumber('3*10^-2')).toBeCloseTo(0.03, 15)
    expect(parseNumber(formatNumber(1.234e-7, 8))).toBeCloseTo(1.234e-7, 20)
    expect(parseNumber('1e-3')).toBe(0.001)
    expect(parseNumber('3,4,5')).toBeUndefined()
    expect(parseNumber('1\u202f000\u202f000')).toBe(1e6)
    expect(formatNumber(1e6 - 1, 7)).toBe('999\u202f999')
    expect(formatNumber(2026)).toBe('2026')
  })

  it('rng is deterministic per seed', () => {
    const a = createRng(5)
    const b = createRng(5)
    const xs = Array.from({ length: 5 }, () => a.next())
    expect(xs).toEqual(Array.from({ length: 5 }, () => b.next()))
    expect(new Set(xs).size).toBe(5)
    expect(createRng(6).next()).not.toBe(xs[0])
  })

  it('sweepTail produces a bifurcation diagram', () => {
    const m = iteration({
      id: 'log',
      params: { a: real('a', { min: 0, max: 4, step: 0.01, default: 2 }) },
      start: () => 0.2,
      step: (x, p) => p.a * x * (1 - x),
      horizon: 10,
    })
    const r = sweepTail(m, defaultParams(m), 'a', [2.5, 3.2], { tail: 4 })
    expect(new Set(Array.from(r.y.subarray(0, 4), (v) => v.toFixed(6))).size).toBe(1)
    expect(new Set(Array.from(r.y.subarray(4), (v) => v.toFixed(6))).size).toBe(2)
  })
})

describe('fixedPoints noise', () => {
  it('reports 0 and slope 0 exactly', () => {
    // x + r (1 − x/K) x with r = 1, K = 5: fixed points 0 and 5, slope 2 and 0
    const f = (x: number) => x + (1 - x / 5) * x
    const fps = fixedPoints(f, -0.05, 7.5)
    expect(fps.map((p) => p.x)).toEqual([0, expect.closeTo(5, 9)])
    expect(fps[1].slope).toBe(0)
  })
})

describe('axis labels with powers of ten', () => {
  it('large and small numbers become mantissas with a common factor', () => {
    const f = makeFrame({ width: 600, height: 400, x: [0, 0.0005], y: [0, 100_000] })
    expect(f.yExp).toBe(5)
    expect(f.yTickLabels.every((s) => s.length <= 4)).toBe(true)
    expect(f.xExp).toBe(-4)
    expect(f.xTickLabels.at(-1)).toMatch(/^5(,0)?$/)
  })
  it('ordinary ranges stay as they are', () => {
    const f = makeFrame({ width: 600, height: 400, x: [0, 40], y: [0, 1] })
    expect(f.xExp).toBe(0)
    expect(f.yTickLabels).toContain('0,5')
  })
  it('the plot keeps its left edge when the labels change length', () => {
    const a = makeFrame({ width: 600, height: 400, x: [0, 1], y: [0, 1] })
    const b = makeFrame({ width: 600, height: 400, x: [0, 1], y: [0.545, 0.59] })
    expect(b.plot.x).toBe(a.plot.x)
  })
})

describe('detail when zoomed (RunOptions.detail)', () => {
  it('closed forms sample only the visible window', () => {
    const m = iteration({ id: 'd', params: { a: real('a', { min: 0, max: 1, step: 0.1, default: 0.5 }) }, start: () => 1, step: (x, p) => p.a * x, horizon: 3 })
    expect(m.run(defaultParams(m), { detail: { x: [0, 1], zoom: 4 } }).series[0].y.length).toBe(4) // an orbit is never resampled
  })
  it('ODEs sample a time window as finely as the whole', () => {
    const m = ode({
      id: 'o',
      params: { k: real('k', { min: 0, max: 1, step: 0.1, default: 1 }) },
      components: [{ id: 'y', label: 'y' }],
      start: () => [1],
      rhs: (_t, y, p) => [-p.k * y[0]],
      tEnd: 10,
      samples: 100,
    })
    const s = m.run(defaultParams(m), { detail: { time: [2, 3], zoom: 10 } }).series[0]
    expect(s.x[0]).toBeCloseTo(2, 12)
    expect(s.x.at(-1)).toBeCloseTo(3, 12)
    expect(s.x.length).toBe(100)
    // a phase plane (no x window) gets more samples instead
    expect(m.run(defaultParams(m), { detail: { zoom: 10 } }).series[0].x.length).toBe(1000)
  })

  it('runs past the end when the visible time reaches beyond it, but not without end', () => {
    const m = ode({
      id: 'o',
      params: { k: real('k', { min: 0, max: 1, step: 0.1, default: 1 }) },
      components: [{ id: 'y', label: 'y' }],
      start: () => [1],
      rhs: (_t, y, p) => [-p.k * y[0]],
      tEnd: 10,
    })
    const s = m.run(defaultParams(m), { detail: { time: [0, 30], zoom: 1 }, observables: false }).series[0]
    expect(s.x.at(-1)).toBeCloseTo(30, 9)
    expect(s.y.at(-1)).toBeCloseTo(Math.exp(-30), 9)
    const far = m.run(defaultParams(m), { detail: { time: [0, 1e9], zoom: 1 }, observables: false }).series[0]
    expect(far.x.at(-1)).toBeCloseTo(10 * MAX_ZOOM_OUT, 6)
  })

  it('iterations go on with the same values, sequences too', () => {
    const m = iteration({
      id: 'i',
      params: { N: steps('N', { default: 10 }) },
      start: () => 1,
      step: (x) => x / 2,
      horizon: (p) => p.N,
    })
    const base = m.run(defaultParams(m), {}).series[0]
    const more = m.run(defaultParams(m), { detail: { time: [0, 25], zoom: 1 }, observables: false }).series[0]
    expect(base.x.length).toBe(11)
    expect(more.x.length).toBe(26)
    expect([...more.y.subarray(0, 11)]).toEqual([...base.y])
    // a window of something else than time changes nothing
    expect(m.run(defaultParams(m), { detail: { x: [0, 25], zoom: 1 } }).series[0].x.length).toBe(11)
  })
})
