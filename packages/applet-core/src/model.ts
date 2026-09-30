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
  /** What the quantity stands for, e.g. "Beute": shown next to the symbol in legends. */
  name?: string
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
  /** Dash pattern, when it differs from the role's (e.g. solid where the role is dashed). */
  dash?: readonly number[]
  /** false: not listed in the legend (e.g. the points of a path that is listed already). */
  legend?: boolean
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
export type ObservableValue = number | string | readonly number[] | readonly string[] | null

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
  /**
   * A plot is zoomed in: compute its curves in more detail. `x` is the visible range of the
   * plot's x axis (whatever that variable is for the model), `zoom` the magnification.
   */
  detail?: Detail
}

/**
 * A zoomed or panned plot asks the model for a drawing run of its window (`RunOptions.detail`,
 * observables off). Builders use `time` themselves (sampling window, running past the end);
 * `extraSeries` may use `x` and `y` to recompute what they draw for the window.
 */
export interface Detail {
  /**
   * The visible range of the plot's x axis, in that plot's own variable: the time t or n
   * for plots over time, the state for cobwebs and function graphs, a parameter for
   * diagrams over a parameter (bifurcation: a). Not set for phase planes, whose axes are
   * states of the solution rather than its variable.
   */
  x?: readonly [number, number]
  /**
   * The visible range of time (t or n), from plots over time. Beyond the end of the model's
   * span the drawing run continues — zoomed out or panned to the right, curves go on.
   */
  time?: readonly [number, number]
  /** The visible range of the y axis (for models that can aim their points at it). */
  y?: readonly [number, number]
  /** Magnification against the full view (≥ 1); more samples, up to MAX_SAMPLES. */
  zoom: number
}

/** More samples when zoomed, up to a limit that keeps a redraw quick. */
export const MAX_SAMPLES = 20_000
/** Zooming out goes to at most this many times the full view, and runs continue as far. */
export const MAX_ZOOM_OUT = 20

/** Where a drawing run ends when the visible time reaches past the model's end. */
export function extendedEnd(start: number, end: number, d?: Detail): number {
  const want = d?.time?.[1]
  if (want === undefined || !(want > end)) return end
  return Math.min(want, start + MAX_ZOOM_OUT * Math.max(end - start, 1))
}

export const detailSamples = (base: number, d?: Detail) => Math.min(MAX_SAMPLES, Math.round(base * Math.max(1, d?.zoom ?? 1)))

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
