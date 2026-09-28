/**
 * Quiz definitions — the second container. A quiz is self-contained (question, checker,
 * hints, solution) and reusable on any page. If it refers to an applet, it only knows the
 * applet's id and reads its state from the channel; it never imports the applet.
 *
 * Text fields accept inline math: `$f'(y^*) = 2 - a$`, display math with `$$…$$`.
 */

import { schwelle, type Params, type Pruefer } from '@abacus/applet-core'

interface Base {
  /** Globally unique and stable: the notebook stores answers under it. */
  id: string
  frage: string
  /** Applet whose live state the checker receives. */
  applet?: string
  /** Progressive hint ladder. */
  tipps?: readonly string[]
  /** Shown only after an attempt has been recorded. */
  loesung?: string
  /** Bump when the question changes meaning, so old answers are not mixed with new ones. */
  version?: number
}

export interface VorhersageQuiz extends Base {
  typ: 'vorhersage'
  /** Multiple choice; free text if omitted. */
  optionen?: readonly string[]
}

export interface FindeQuiz extends Base {
  typ: 'finde'
  /** The quantity, e.g. "a" or "t*". */
  groesse: string
  einheit?: string
  /** Stated to the student ("auf 0,05 genau"). */
  toleranz?: number
  pruefer?: Pruefer<any>
  /** sofort: immediate diagnosis · spaeter: stored, confronted with the proof later · keine: recorded only. */
  pruefung?: 'sofort' | 'spaeter' | 'keine'
}

export interface ErzeugeQuiz extends Base {
  typ: 'erzeuge'
  applet: string
  /** Receives the applet's current params and observables. */
  pruefer: Pruefer<any>
}

export interface AntwortQuiz extends Base {
  typ: 'antwort'
}

export type QuizDef = VorhersageQuiz | FindeQuiz | ErzeugeQuiz | AntwortQuiz

type FindeInput = Omit<FindeQuiz, 'pruefer'> & ({ pruefer: Pruefer<any>; ziel?: never } | { ziel: number; pruefer?: never } | { ziel?: never; pruefer?: never })

/** Shorthand: `{ typ: 'finde', ziel: 3, toleranz: 0.05 }` builds the `schwelle` checker. */
export function defineQuiz<P extends Params = Params>(def: Exclude<QuizDef, FindeQuiz> | FindeInput): QuizDef {
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(def.id)) throw new Error(`Quiz id "${def.id}": letters, digits, '-' and '_' only.`)
  if (def.typ === 'finde' && 'ziel' in def && def.ziel !== undefined) {
    const { ziel, ...rest } = def
    return { ...rest, pruefer: schwelle<P>({ ziel, toleranz: def.toleranz ?? 0 }) }
  }
  return def as QuizDef
}
