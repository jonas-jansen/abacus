/** Models, runs, series and observables (spec §4.3–4.5). */

import {
  checkValue,
  coerce,
  defaultsOf,
  sameValue,
  specsOf,
  type ParamDefs,
  type ParamSpec,
  type ParamValue,
  type Params,
  type ParamsOf,
} from './params'

export type ModelKind = 'iteration' | 'closedForm' | 'ode'

/** Series carry a role, never a colour (§5.5). */
export type SeriesRole = 'primary' | 'secondary' | 'tertiary' | 'reference' | 'ghost' | 'annotation' | 'grid' | 'data'

export interface Series {
  id: string
  /** TeX, e.g. `x_n`, `y_1(t)`; typeset in legends. */
  label: string
  kind: 'discrete' | 'continuous'
  x: Float64Array
  y: Float64Array
  role: SeriesRole
  /** Discrete series only: join the points (default true). Measured data usually is not joined. */
  connect?: boolean
  /** Continuous series: the pieces between NaN gaps are closed and filled (areas, rectangles). */
  fill?: boolean
  /** Continuous series: an arrowhead at the end of each piece (vectors). */
  arrow?: boolean
}

/**
 * z = f(x, y) sampled on a grid, for 3D surfaces. `z[j * x.length + i]` belongs to
 * (x[i], y[j]). `ref`, if given, is compared with z: the surface is coloured by the sign of
 * z − ref and the curve z = ref is drawn (e.g. where a population neither grows nor shrinks).
 */
export interface Grid {
  id: string
  label: string
  x: Float64Array
  y: Float64Array
  z: Float64Array
  ref?: Float64Array
  /** TeX name of the reference, e.g. `y_1`. */
  refLabel?: string
  /** A point of interest on the surface, e.g. the current state. */
  marker?: readonly [number, number]
}

/** Which plane a mark lives in: time series (t, x), map or graph (x, f(x)), phase plane (x, y). */
export type MarkSpace = 'time' | 'map' | 'phase'

/**
 * Geometry an observable refers to. The plots highlight it while the student points at the
 * readout, so "which of these is the fixed point?" is answered by looking. `item` ties a mark
 * to one entry of a `liste`; marks without it belong to the whole readout.
 */
export type Mark =
  /** A state value: a horizontal line over time; on a cobweb the point (v, v) on the diagonal. */
  | { kind: 'value'; v: number; item?: number }
  /** A time or index: a vertical line in time series. */
  | { kind: 'time'; t: number; item?: number }
  | { kind: 'point'; x: number; y: number; in: MarkSpace; item?: number }
  /** The line through (x, y) with the given slope; ±Infinity is vertical. */
  | { kind: 'line'; x: number; y: number; slope: number; in: MarkSpace; item?: number }

/** `liste` observables carry an array; everything else a scalar. `null` = not detected. */
export type ObservableValue = number | string | readonly number[] | null

export interface Observable {
  value: ObservableValue
  kind: 'zahl' | 'index' | 'klasse' | 'liste'
  label: string
  format?: (v: ObservableValue) => string
  /** Detection tolerance used. */
  tol?: number
  /** Shown to the student, e.g. "keine Periode ≤ 16 gefunden". */
  note?: string
  /** Significant digits for numbers (default 4). */
  digits?: number
  /** Highlighted in the plots while the readout is pointed at. */
  marks?: readonly Mark[]
}

export type Observables = Readonly<Record<string, Observable>>

export interface RunOptions {
  /** n_max for iterations, t_end for continuous models. */
  horizon: number
  samples?: number
  seed?: number
  tol?: number
  /** false skips the observables — sweeps need only the series, and detectors can be costly. */
  observables?: boolean
}

export interface RunMeta {
  solver?: string
  steps?: number
  warnings?: string[]
}

export interface Run {
  series: Series[]
  observables: Observables
  meta: RunMeta
  /** Surfaces over the plane (3D plots). */
  grids?: Grid[]
  /** The vector field of a planar ODE, for direction fields in the phase plane. */
  field?: (x: number, y: number) => readonly [number, number]
  /** The right-hand side of a scalar ODE x' = f(t, x), for slope fields over time. */
  slope?: (t: number, x: number) => number
}

/**
 * `run` must be pure: same input, same output, no globals, no `Date`, no unseeded randomness.
 * Declared with method syntax on purpose, so a `Model<{ a: number }>` is usable wherever a
 * `Model<Params>` is expected.
 */
export interface Model<P extends Params = Params> {
  readonly id: string
  readonly kind: ModelKind
  readonly params: readonly ParamSpec[]
  /** Shown to the student, e.g. "α + γ ≤ 1". */
  readonly constraintNote?: string
  /** Must be idempotent (§4.2). Applied after every change and after URL decoding. */
  normalize?(p: P): P
  run(p: P, opts?: Partial<RunOptions>): Run
}

export type AnyModel = Model<any>

export interface ModelConfig<D extends ParamDefs> {
  id: string
  kind: ModelKind
  params: D
  normalize?: (p: ParamsOf<D>) => ParamsOf<D>
  constraintNote?: string
  run: (p: ParamsOf<D>, opts: Partial<RunOptions>) => Run
}

/** Lowest-level way to declare a model. Prefer `iteration`, `closedForm` or `ode`. */
export function defineModel<const D extends ParamDefs>(cfg: ModelConfig<D>): Model<ParamsOf<D>> {
  const model: Model<ParamsOf<D>> = {
    id: cfg.id,
    kind: cfg.kind,
    params: specsOf(cfg.params),
    constraintNote: cfg.constraintNote,
    run: (p, opts = {}) => cfg.run(p, opts),
  }
  if (cfg.normalize) model.normalize = cfg.normalize
  return model
}

export function normalizeParams<P extends Params>(model: Model<P>, p: P): P {
  return model.normalize ? model.normalize(p) : p
}

export function defaultParams<P extends Params>(model: Model<P>): P {
  return normalizeParams(model, defaultsOf(model.params) as unknown as P)
}

export interface ExplainedChange<P> {
  params: P
  /** Present when the value the student asked for could not be used as is. */
  message?: string
}

/**
 * One parameter change as the student made it: like `updateParams`, but says why the result
 * differs from the request — a hard limit, rounding, or a coupling enforced by `normalize`.
 */
export function explainChange<P extends Params>(model: Model<P>, base: P, id: string, raw: unknown): ExplainedChange<P> {
  const spec = model.params.find((s) => s.id === id)
  const checked = spec ? checkValue(spec, raw) : undefined
  if (!spec || !checked) return { params: base, message: spec ? 'Diese Eingabe ist keine Zahl.' : undefined }
  const params = normalizeParams(model, { ...base, [id]: checked.value } as P)
  if (checked.message) return { params, message: checked.message }
  if (!sameValue(params[id], checked.value)) {
    return { params, message: model.constraintNote ? `Angepasst, weil ${model.constraintNote}.` : 'Der Wert wurde an die Bedingungen des Modells angepasst.' }
  }
  return { params }
}

/**
 * The single entry point for changing parameters: validates each patched value against its
 * spec, merges, then normalizes. Unknown keys and uninterpretable values are ignored.
 */
export function updateParams<P extends Params>(model: Model<P>, base: P, patch: Readonly<Record<string, unknown>>): P {
  const next: Record<string, ParamValue> = { ...base }
  for (const spec of model.params) {
    if (!(spec.id in patch)) continue
    const v = coerce(spec, patch[spec.id])
    if (v !== undefined) next[spec.id] = v
  }
  return normalizeParams(model, next as unknown as P)
}
