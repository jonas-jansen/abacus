/**
 * Sweeps (§4.6): a family of runs rather than one — order of convergence, bifurcation
 * diagrams, response curves. This is why `run` must be cheap and pure.
 */

import { normalizeParams, type Model, type Run, type RunOptions } from './model'
import type { Params } from './params'

export interface SweepResult {
  x: Float64Array
  y: Float64Array
}

export function sweep1d<P extends Params>(
  model: Model<P>,
  p: P,
  paramId: keyof P & string,
  values: ArrayLike<number>,
  extract: (r: Run) => number,
  opts: Partial<RunOptions> = {},
): SweepResult {
  const x = Float64Array.from(values as ArrayLike<number>)
  const y = new Float64Array(x.length)
  for (let i = 0; i < x.length; i++) {
    const q = normalizeParams(model, { ...p, [paramId]: x[i] })
    y[i] = extract(model.run(q, { observables: false, ...opts }))
  }
  return { x, y }
}

/** Parameter against the last `tail` values of a series: the bifurcation diagram. */
export function sweepTail<P extends Params>(
  model: Model<P>,
  p: P,
  paramId: keyof P & string,
  values: ArrayLike<number>,
  { seriesId, transient = 500, tail = 64 }: { seriesId?: string; transient?: number; tail?: number } = {},
): SweepResult {
  const x = new Float64Array(values.length * tail)
  const y = new Float64Array(values.length * tail)
  for (let i = 0; i < values.length; i++) {
    const q = normalizeParams(model, { ...p, [paramId]: values[i] })
    const run = model.run(q, { horizon: transient + tail, observables: false })
    const s = (seriesId ? run.series.find((s) => s.id === seriesId) : run.series[0])?.y
    for (let j = 0; j < tail; j++) {
      x[i * tail + j] = values[i]
      y[i * tail + j] = s ? s[s.length - tail + j] : NaN
    }
  }
  return { x, y }
}
