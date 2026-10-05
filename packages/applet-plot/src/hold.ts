/**
 * Axes that tell the truth while parameters change. If a plot refitted its axes to the data
 * after every change, a larger start value would make a line look flatter, a larger rate
 * would look like the same curve: the picture would lie about what changed.
 *
 * So the window is held: kept while the data fits; moved (same scale) when the data has left
 * it but would fit; grown in clear steps when it no longer fits; never shrunk on its own. A
 * refit happens only when asked ("ganzes Bild", reset, a scenario).
 */

import type { Range } from '@abacus/applet-core'

export interface HoldOptions {
  /** A logarithmic axis: moving and growing happen in powers of ten. */
  log?: boolean
  /** Grow when the data no longer fits (default). Off: keep the scale; the caller offers a refit. */
  grow?: boolean
}

/** Growth factor when the data no longer fits: big enough that it rarely happens twice in a row. */
const GROW = 2

/** The window after a change, given the one before (null: none yet) and the data's own fit. */
export function holdRange(prev: Range | null, fit: Range, o: HoldOptions = {}): Range {
  if (!prev || !(prev[1] > prev[0])) return fit
  const to = (v: number) => (o.log ? Math.log10(v) : v)
  const from = (v: number) => (o.log ? 10 ** v : v)
  if (o.log && !(prev[0] > 0 && fit[0] > 0)) return fit
  const [plo, phi] = [to(prev[0]), to(prev[1])]
  const [nlo, nhi] = [to(fit[0]), to(fit[1])]
  const eps = 1e-9 * Math.max(1, Math.abs(phi - plo))
  // still fits: keep
  if (nlo >= plo - eps && nhi <= phi + eps) return prev
  const span = phi - plo
  const need = nhi - nlo
  // a fit that starts at 0 (a quantity never negative) keeps its axis at 0
  const floor = !o.log && fit[0] === 0 && prev[0] === 0 ? 0 : undefined
  if (need <= span + eps && floor === undefined) {
    // move, same scale: just far enough to take the data in
    const shift = nlo < plo ? nlo - plo : nhi - phi
    return [from(plo + shift), from(phi + shift)]
  }
  if (o.grow === false) {
    // no growing: move as far into the data as the window allows, at the same scale
    if (floor !== undefined) return prev
    const lo = Math.min(Math.max(plo, nlo), nhi - span)
    return [from(lo), from(lo + span)]
  }
  // grow in steps, keeping the side the data has not left
  let size = span
  while (size < need - eps) size *= GROW
  let lo: number
  if (floor !== undefined) lo = floor
  else if (nlo >= plo) lo = plo
  else if (nhi <= phi) lo = phi - size
  else lo = nlo - (size - need) / 2
  return [from(lo), from(lo + size)]
}

/** Whether the data reaches beyond the window (with axes that do not grow by themselves). */
export function overflows(held: Range, fit: Range): boolean {
  const eps = 1e-9 * Math.max(1, Math.abs(held[1] - held[0]))
  return fit[0] < held[0] - eps || fit[1] > held[1] + eps
}

/** Whether a held window is much larger than the data needs (then a refit is offered). */
export function roomy(held: Range, fit: Range, log = false): boolean {
  const len = (r: Range) => (log ? Math.log10(r[1]) - Math.log10(r[0]) : r[1] - r[0])
  return len(held) > 3 * len(fit)
}
