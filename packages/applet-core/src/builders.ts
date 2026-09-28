/**
 * Model builders — the fast path for new applets. Each takes the mathematics (update rule,
 * formula, right-hand side) plus labels and returns a pure `Model`. Observables are a
 * function of a context object that already holds the computed arrays.
 */

import { defineModel, type Model, type Observable, type Series, type SeriesRole } from './model'
import { indices, linspace } from './numeric'
import type { ParamDefs, ParamsOf } from './params'
import { createRng, type Rng } from './rng'
import { rk45, type DenseSolution } from './solvers/rk45'
import { rosenbrock } from './solvers/rosenbrock'

/** rk45 steps after which `stiff: 'auto'` gives up and switches to Rosenbrock. */
const AUTO_STIFF_STEPS = 4000

type Resolvable<T, P> = T | ((p: P) => T)
const resolve = <T, P>(v: Resolvable<T, P>, p: P): T => (typeof v === 'function' ? (v as (p: P) => T)(p) : v)

export interface Component {
  id: string
  label: string
  role?: SeriesRole
}

const DEFAULT_ROLES: SeriesRole[] = ['primary', 'secondary', 'tertiary']
const roleAt = (c: Partial<Component>, i: number): SeriesRole => c.role ?? DEFAULT_ROLES[i % DEFAULT_ROLES.length]

interface Common<D extends ParamDefs> {
  id: string
  params: D
  /** Must be idempotent. */
  normalize?: (p: ParamsOf<D>) => ParamsOf<D>
  constraintNote?: string
}

type ObservableMap = Record<string, Observable>

// ---------------------------------------------------------------------------------------
// Scalar iteration  x_{n+1} = step(x_n)

export interface IterationContext<P> {
  p: P
  /** 0, 1, …, N */
  n: Float64Array
  /** x_0, …, x_N */
  x: Float64Array
  /** The update map at n = 0 with a fresh generator — for fixed points and cobwebs. */
  map: (x: number) => number
  /** Continue iterating from the start value: drop `transient` steps, return the next `count`. */
  tail: (transient: number, count: number) => Float64Array
}

export interface IterationConfig<D extends ParamDefs> extends Common<D> {
  start: (p: ParamsOf<D>) => number
  step: (x: number, p: ParamsOf<D>, n: number, rng: Rng) => number
  /** Number of steps N. `RunOptions.horizon` overrides it (sweeps). */
  horizon: Resolvable<number, ParamsOf<D>>
  /** Seed for `rng` when the run options give none; may depend on the parameters. */
  seed?: Resolvable<number, ParamsOf<D>>
  /** Id, label (TeX) and role of the orbit series. Default `{ id: 'x', label: 'x_n' }`. */
  series?: Partial<Component>
  /** Additional series, e.g. the graph of f for a cobweb. */
  extraSeries?: (ctx: IterationContext<ParamsOf<D>>) => Series[]
  observables?: (ctx: IterationContext<ParamsOf<D>>) => ObservableMap
}

export function iteration<const D extends ParamDefs>(cfg: IterationConfig<D>): Model<ParamsOf<D>> {
  return defineModel({
    id: cfg.id,
    kind: 'iteration',
    params: cfg.params,
    normalize: cfg.normalize,
    constraintNote: cfg.constraintNote,
    run(p, opts) {
      const N = Math.max(0, Math.floor(opts.horizon ?? resolve(cfg.horizon, p)))
      const seed = opts.seed ?? (cfg.seed === undefined ? 1 : resolve(cfg.seed, p))
      const iterate = (count: number) => {
        const rng = createRng(seed)
        const x = new Float64Array(count + 1)
        x[0] = cfg.start(p)
        for (let n = 0; n < count; n++) x[n + 1] = cfg.step(x[n], p, n, rng)
        return x
      }
      const x = iterate(N)
      const n = indices(N + 1)
      const ctx: IterationContext<ParamsOf<D>> = {
        p,
        n,
        x,
        map: (v) => cfg.step(v, p, 0, createRng(seed)),
        tail: (transient, count) => iterate(transient + count).subarray(transient + 1),
      }
      const s = cfg.series ?? {}
      const orbit: Series = {
        id: s.id ?? 'x',
        label: s.label ?? 'x_n',
        kind: 'discrete',
        x: n,
        y: x,
        role: s.role ?? 'primary',
      }
      return {
        series: [orbit, ...(cfg.extraSeries?.(ctx) ?? [])],
        observables: opts.observables === false ? {} : (cfg.observables?.(ctx) ?? {}),
        meta: { steps: N },
      }
    },
  })
}

// ---------------------------------------------------------------------------------------
// Vector iteration  x_{n+1} = step(x_n),  x ∈ ℝᵈ

export interface IterationNContext<P> {
  p: P
  n: Float64Array
  /** One array per component. */
  x: Float64Array[]
  tail: (transient: number, count: number) => Float64Array[]
}

export interface IterationNConfig<D extends ParamDefs> extends Common<D> {
  components: readonly Component[]
  start: (p: ParamsOf<D>) => readonly number[]
  step: (x: readonly number[], p: ParamsOf<D>, n: number, rng: Rng) => readonly number[]
  horizon: Resolvable<number, ParamsOf<D>>
  seed?: Resolvable<number, ParamsOf<D>>
  extraSeries?: (ctx: IterationNContext<ParamsOf<D>>) => Series[]
  observables?: (ctx: IterationNContext<ParamsOf<D>>) => ObservableMap
}

export function iterationN<const D extends ParamDefs>(cfg: IterationNConfig<D>): Model<ParamsOf<D>> {
  const dim = cfg.components.length
  return defineModel({
    id: cfg.id,
    kind: 'iteration',
    params: cfg.params,
    normalize: cfg.normalize,
    constraintNote: cfg.constraintNote,
    run(p, opts) {
      const N = Math.max(0, Math.floor(opts.horizon ?? resolve(cfg.horizon, p)))
      const seed = opts.seed ?? (cfg.seed === undefined ? 1 : resolve(cfg.seed, p))
      const iterate = (count: number) => {
        const rng = createRng(seed)
        const xs = Array.from({ length: dim }, () => new Float64Array(count + 1))
        let cur = cfg.start(p)
        for (let i = 0; i < dim; i++) xs[i][0] = cur[i]
        for (let n = 0; n < count; n++) {
          cur = cfg.step(cur, p, n, rng)
          for (let i = 0; i < dim; i++) xs[i][n + 1] = cur[i]
        }
        return xs
      }
      const x = iterate(N)
      const n = indices(N + 1)
      const ctx: IterationNContext<ParamsOf<D>> = {
        p,
        n,
        x,
        tail: (transient, count) => iterate(transient + count).map((c) => c.subarray(transient + 1)),
      }
      const series: Series[] = cfg.components.map((c, i) => ({
        id: c.id,
        label: c.label,
        kind: 'discrete',
        x: n,
        y: x[i],
        role: roleAt(c, i),
      }))
      return {
        series: [...series, ...(cfg.extraSeries?.(ctx) ?? [])],
        observables: opts.observables === false ? {} : (cfg.observables?.(ctx) ?? {}),
        meta: { steps: N },
      }
    },
  })
}

// ---------------------------------------------------------------------------------------
// Closed form  y = f(t)

export interface Curve<P> {
  label: string
  role?: SeriesRole
  f: (t: number, p: P) => number
}

export interface ClosedFormContext<P> {
  p: P
  domain: readonly [number, number]
  series: Record<string, Series>
  /** Evaluate a declared curve anywhere, not just at the samples. */
  curve: (id: string, t: number) => number
}

export interface ClosedFormConfig<D extends ParamDefs> extends Common<D> {
  /** Range of the independent variable. For `discrete` models, the index range. */
  domain: Resolvable<readonly [number, number], ParamsOf<D>>
  /** Evaluate at integers only (sequences given by a formula). */
  discrete?: boolean
  /** Samples for continuous curves. Default 400. */
  samples?: number
  curves: Record<string, Curve<ParamsOf<D>>>
  /** When the curves solve x' = f(t, x): f, for a slope field behind them. */
  slope?: (t: number, x: number, p: ParamsOf<D>) => number
  extraSeries?: (ctx: ClosedFormContext<ParamsOf<D>>) => Series[]
  observables?: (ctx: ClosedFormContext<ParamsOf<D>>) => ObservableMap
}

export function closedForm<const D extends ParamDefs>(cfg: ClosedFormConfig<D>): Model<ParamsOf<D>> {
  return defineModel({
    id: cfg.id,
    kind: 'closedForm',
    params: cfg.params,
    normalize: cfg.normalize,
    constraintNote: cfg.constraintNote,
    run(p, opts) {
      const [a, b0] = resolve(cfg.domain, p)
      const b = opts.horizon ?? b0
      const t = cfg.discrete
        ? indices(Math.max(0, Math.floor(b) - Math.ceil(a)) + 1).map((i) => i + Math.ceil(a))
        : linspace(a, b, opts.samples ?? cfg.samples ?? 400)
      const series: Record<string, Series> = {}
      Object.entries(cfg.curves).forEach(([id, c], i) => {
        const y = new Float64Array(t.length)
        for (let j = 0; j < t.length; j++) y[j] = c.f(t[j], p)
        series[id] = { id, label: c.label, kind: cfg.discrete ? 'discrete' : 'continuous', x: t, y, role: roleAt(c, i) }
      })
      const ctx: ClosedFormContext<ParamsOf<D>> = {
        p,
        domain: [a, b],
        series,
        curve: (id, tq) => cfg.curves[id].f(tq, p),
      }
      return {
        series: [...Object.values(series), ...(cfg.extraSeries?.(ctx) ?? [])],
        observables: opts.observables === false ? {} : (cfg.observables?.(ctx) ?? {}),
        meta: {},
        slope: cfg.slope && ((tt: number, x: number) => cfg.slope!(tt, x, p)),
      }
    },
  })
}

// ---------------------------------------------------------------------------------------
// ODE  y' = rhs(t, y)

/** For two-component systems: the right-hand side as a field over the phase plane (at t₀). */
function planarField(dim: number, rhs: (y: Float64Array) => ArrayLike<number>) {
  if (dim !== 2) return undefined
  const y = new Float64Array(2)
  return (a: number, b: number): readonly [number, number] => {
    y[0] = a
    y[1] = b
    const r = rhs(y)
    return [r[0], r[1]]
  }
}

export interface OdeContext<P> {
  p: P
  sol: DenseSolution
  series: Record<string, Series>
}

export interface OdeConfig<D extends ParamDefs> extends Common<D> {
  components: readonly Component[]
  start: (p: ParamsOf<D>) => readonly number[]
  rhs: (t: number, y: Float64Array, p: ParamsOf<D>) => ArrayLike<number>
  /** End time. `RunOptions.horizon` overrides it. */
  tEnd: Resolvable<number, ParamsOf<D>>
  t0?: number
  /**
   * `true`: the Rosenbrock solver. `'auto'`: rk45 first, Rosenbrock if rk45 needs too many
   * steps — the sign of stiffness. Default false.
   */
  stiff?: boolean | 'auto'
  samples?: number
  /** Relative tolerance. Default 1e-6. */
  tol?: number
  extraSeries?: (ctx: OdeContext<ParamsOf<D>>) => Series[]
  observables?: (ctx: OdeContext<ParamsOf<D>>) => ObservableMap
}

export function ode<const D extends ParamDefs>(cfg: OdeConfig<D>): Model<ParamsOf<D>> {
  return defineModel({
    id: cfg.id,
    kind: 'ode',
    params: cfg.params,
    normalize: cfg.normalize,
    constraintNote: cfg.constraintNote,
    run(p, opts) {
      const t0 = cfg.t0 ?? 0
      const t1 = opts.horizon ?? resolve(cfg.tEnd, p)
      const tol = opts.tol ?? cfg.tol ?? 1e-6
      const f = (t: number, y: Float64Array) => cfg.rhs(t, y, p)
      const o = { rtol: tol, atol: tol * 1e-3 }
      let sol: DenseSolution
      if (cfg.stiff === true) sol = rosenbrock(f, t0, cfg.start(p), t1, o)
      else if (cfg.stiff === 'auto') {
        const explicit = rk45(f, t0, cfg.start(p), t1, { ...o, maxSteps: AUTO_STIFF_STEPS })
        sol = explicit.warnings.length ? rosenbrock(f, t0, cfg.start(p), t1, o) : explicit
      } else sol = rk45(f, t0, cfg.start(p), t1, o)
      const { t, y } = sol.sample(opts.samples ?? cfg.samples ?? 400)
      const series: Record<string, Series> = {}
      cfg.components.forEach((c, i) => {
        series[c.id] = { id: c.id, label: c.label, kind: 'continuous', x: t, y: y[i], role: roleAt(c, i) }
      })
      const ctx: OdeContext<ParamsOf<D>> = { p, sol, series }
      return {
        series: [...Object.values(series), ...(cfg.extraSeries?.(ctx) ?? [])],
        observables: opts.observables === false ? {} : (cfg.observables?.(ctx) ?? {}),
        meta: { solver: sol.solver, steps: sol.steps, warnings: sol.warnings.length ? sol.warnings : undefined },
        field: planarField(cfg.components.length, (y) => cfg.rhs(t0, y, p)),
      }
    },
  })
}
