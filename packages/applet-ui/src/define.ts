/**
 * Applet definitions (§10) — what an author writes in `applets`, and nothing more.
 * React-free, so definitions stay pure data + functions. Questions about an applet are not
 * part of it: they are quizzes (`@abacus/quiz`), reusable on their own.
 */

import type { Model, Params, RunOptions } from '@abacus/applet-core'
import type { Domain, PlotSpec } from '@abacus/applet-plot'
import type { Formel } from './formula'

export type { Formel } from './formula'

export type Resolvable<T, P> = T | ((p: P) => T)

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/**
 * Direct manipulation on the plot: a point the student drags to change a parameter.
 *
 * Simple form: `{ param: 'x0', axis: 'x' }` — the handle *is* the parameter's value.
 * General form: `at` says where the handle sits and `set` what a drag changes, so a handle
 * can stand for anything with a place in the picture — the last point of a sequence (its
 * growth rate), a level line (a capacity), the peak of a parabola (a coefficient).
 */
export interface DragHandle<P = Params> {
  /** The parameter this handle controls: its symbol labels the tooltip, and its slider row lights up while dragging. */
  param: string
  /** 'x' or 'y': moves along one axis; 'xy': freely. */
  axis: 'x' | 'y' | 'xy'
  /** Where the handle sits, in data coordinates; null hides it. Default: the parameter's value (on the axis it moves along). */
  at?: (p: P) => readonly [number, number] | null
  /** The change a drag to (x, y) makes. Default: sets `param` to x, y or [x, y]. */
  set?: (x: number, y: number, p: P) => Readonly<Record<string, unknown>>
  /** Further parameters the drag changes, shown in the tooltip too. */
  also?: readonly string[]
  /** TeX label next to the handle. Default: the parameter's symbol. */
  label?: string
}

/** A PlotSpec whose domains may depend on the parameters, plus optional handles. */
export type PlotEntry<P> = DistributiveOmit<PlotSpec, 'x' | 'y'> & {
  x?: Resolvable<Domain, P>
  y?: Resolvable<Domain, P>
  /** One handle or several. */
  drag?: DragHandle<P> | readonly DragHandle<P>[]
}

export const handlesOf = <P,>(entry: PlotEntry<P>): readonly DragHandle<P>[] =>
  entry.drag === undefined ? [] : Array.isArray(entry.drag) ? entry.drag : [entry.drag as DragHandle<P>]

export interface LayoutHint<P = Params> {
  /** Parameters shown up front. The rest go into "weitere Parameter". Default: all if ≤ 4, else the first three. */
  main?: readonly string[]
  /** Parameters that only matter in some settings, e.g. `{ b: (p) => p.form === 'linear' }`. */
  sichtbar?: Readonly<Record<string, (p: P) => boolean>>
}

export interface AppletDef<P extends Params = Params> {
  /** Stable, URL-safe, no dots. Used in the URL hash, on the channel and in routes. */
  id: string
  titel: string
  kurz: string
  model: Model<P>
  /**
   * The model as formulas with live parameters, e.g.
   * `[{ label: 'Vorschrift', tex: 'x_{n+1} = {{a}}\\,x_n' }]` (syntax: formula.ts).
   * A function when the formulas depend on a setting.
   */
  formeln?: readonly Formel[] | ((p: P) => readonly Formel[])
  /** One island, however many plots it drives (§10). */
  plots: readonly PlotEntry<P>[]
  layout?: LayoutHint<P>
  /** Observable ids to display live. */
  anzeige?: readonly string[]
  /**
   * Show the timeline (play, scrub). Default: on for iterations and ODEs, off for closed
   * forms — set it when a closed form is a motion in time.
   */
  zeitleiste?: boolean
  /** Open the timeline at the start instead of showing everything. */
  schritte?: boolean
  runOptions?: (p: P) => Partial<RunOptions>
}

export type AnyAppletDef = AppletDef<any>

export function defineApplet<P extends Params>(def: AppletDef<P>): AppletDef<P> {
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(def.id)) {
    throw new Error(`Applet id "${def.id}" must be URL-safe: letters, digits, '-' and '_' only.`)
  }
  const ids = new Set(def.model.params.map((s) => s.id))
  for (const plot of def.plots) {
    for (const h of handlesOf(plot)) {
      if (!ids.has(h.param)) throw new Error(`Applet "${def.id}": drag handle refers to unknown parameter "${h.param}".`)
    }
  }
  for (const id of [...(def.layout?.main ?? []), ...Object.keys(def.layout?.sichtbar ?? {})]) {
    if (!ids.has(id)) throw new Error(`Applet "${def.id}": layout.main refers to unknown parameter "${id}".`)
  }
  return def
}
